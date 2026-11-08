import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl, type ModelObject } from '../scene/schema';
import { useEditor } from '../../stores/editor';
import type { Compositor } from './Compositor';
import type { Segmenter } from '../segmentation/Segmenter';

function disposeObject(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse(node => { if (node instanceof T.Mesh) { geometries.add(node.geometry); (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m)); } });
  materials.forEach(m => { Object.values(m).forEach(v => { if (v instanceof T.Texture) textures.add(v); }); m.dispose(); });
  textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose());
}
function Imported({ asset, report }: { asset: string; report: (message: string) => void }) {
  const [root, setRoot] = useState<T.Group | null>(null);
  useEffect(() => {
    let cancelled = false, owned: T.Group | undefined;
    setRoot(null);
    const manager = new T.LoadingManager();
    manager.setURLModifier(url => {
      if (url.startsWith('roomshift://assets/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
      throw new Error('External model dependencies are not allowed. Use an embedded GLB.');
    });
    new GLTFLoader(manager).load(assetUrl(asset), gltf => {
      if (cancelled) { disposeObject(gltf.scene); return; }
      owned = gltf.scene;
      const bounds = new T.Box3().setFromObject(owned), size = bounds.getSize(new T.Vector3());
      const max = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(max) || max < .000001) { disposeObject(owned); owned = undefined; report('Model has no visible geometry.'); return; }
      const center = bounds.getCenter(new T.Vector3());
      owned.position.copy(center).multiplyScalar(-1 / max); owned.scale.setScalar(1 / max);
      setRoot(owned);
    }, undefined, error => { if (!cancelled) report(`Model could not load: ${String(error)}`); });
    return () => { cancelled = true; if (owned) disposeObject(owned); };
  }, [asset, report]);
  return root ? <primitive object={root} /> : null;
}
function Model({ object, report }: { object: ModelObject; report: (message: string) => void }) {
  const group = useRef<T.Group>(null);
  // Apply opacity without replacing GLTF materials or losing texture maps.
  useFrame(() => group.current?.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.userData.originalOpacity ??= material.opacity;
      material.userData.originalTransparent ??= material.transparent;
      const transparent = material.userData.originalTransparent || object.opacity < 1;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = material.userData.originalOpacity * object.opacity;
    }
  }));
  return <group ref={group} name={`object-${object.id}`} visible={object.visible} position={object.position} rotation={object.rotation} scale={object.scale}
    onPointerDown={e => { if (useEditor.getState().editing && object.visible) { e.stopPropagation(); useEditor.getState().select(object.id); } }}>
    {object.asset === 'builtin:plant' ? <>
      <mesh position={[0, -.25, 0]}><cylinderGeometry args={[.22, .15, .4, 32]} /><meshStandardMaterial color="#c78c68" /></mesh>
      {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 2.4) * .18, .05 + i * .07, Math.cos(i * 2.4) * .13]} rotation={[.2, i, .4]} scale={[.16, .32, .09]}><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color={i % 2 ? '#5b9f71' : '#337952'} /></mesh>)}
    </> : object.asset === 'builtin:sculpture' ? <>
      <mesh rotation={[.3, .3, 0]}><torusKnotGeometry args={[.24, .075, 100, 16]} /><meshStandardMaterial color="#d6b777" metalness={.6} roughness={.25} /></mesh>
      <mesh position={[0, -.43, 0]}><boxGeometry args={[.55, .12, .45]} /><meshStandardMaterial color="#c1c6bd" /></mesh>
    </> : <Imported asset={object.asset} report={report} />}
  </group>;
}
export function ModelStage({ engine, video, active, segmenter, report, diagnostics, mode }: {
  engine: Compositor; video: HTMLVideoElement; active: boolean; segmenter: Segmenter | null;
  report: (message: string) => void; diagnostics: (fps: number, ms: number) => void; mode: 'translate' | 'rotate' | 'scale';
}) {
  const room = useEditor(s => s.scene), selected = useEditor(s => s.selected), editing = useEditor(s => s.editing);
  const models = useRef<T.Group>(null), helpers = useRef<T.Group>(null);
  const { scene, camera, gl } = useThree();
  const [target, setTarget] = useState<T.Object3D | null>(null);
  const timing = useRef({ last: 0, start: performance.now(), frames: 0, ms: 0 });
  useEffect(() => {
    if (camera instanceof T.PerspectiveCamera) { camera.fov = room.camera.fov; camera.updateProjectionMatrix(); }
  }, [camera, room.camera.fov]);
  useEffect(() => { setTarget(selected && editing ? scene.getObjectByName(`object-${selected}`) ?? null : null); }, [scene, selected, editing, room.objects]);
  useEffect(() => {
    if (!target || !helpers.current) return;
    const box = new T.BoxHelper(target, '#a9f3c1');
    box.material.depthTest = false;
    helpers.current.add(box);
    return () => { box.removeFromParent(); box.geometry.dispose(); box.material.dispose(); };
  }, [target]);
  useFrame(() => {
    const now = performance.now(), t = timing.current;
    if (now - t.last < 1000 / room.output.fps - .5) return;
    t.last = now;
    const start = performance.now();
    if (camera instanceof T.PerspectiveCamera) camera.updateProjectionMatrix();
    if (active) segmenter?.tick(video, now, room.output.quality);
    if (helpers.current) { helpers.current.visible = false; helpers.current.children.forEach(c => { if (c instanceof T.BoxHelper) c.update(); }); }
    if (models.current) models.current.visible = true;
    gl.setClearColor(0, 0); gl.clear(); gl.render(scene, camera);
    // Upload the clean model pass before clearing the editor's WebGL canvas.
    engine.render(gl.domElement, active);
    // Mirror the editor camera projection, not the DOM event surface. Gizmo raycasts
    // then use the same mirrored projection that the user actually sees.
    if (room.camera.mirrorPreview) {
      camera.projectionMatrix.elements[0] *= -1;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    if (models.current) models.current.visible = false;
    if (helpers.current) helpers.current.visible = editing;
    gl.clear(); gl.render(scene, camera);
    if (models.current) models.current.visible = true;
    t.frames++; t.ms += performance.now() - start;
    if (now - t.start >= 1000) { diagnostics(Math.round(t.frames * 1000 / (now - t.start)), t.ms / t.frames); t.frames = 0; t.ms = 0; t.start = now; }
  }, 1);
  return <>
    <ambientLight intensity={1.5} /><directionalLight position={[2, 4, 3]} intensity={3} />
    <group ref={models}>{room.objects.filter((o): o is ModelObject => o.kind === 'model').map(o => <Model key={o.id} object={o} report={report} />)}</group>
    <group ref={helpers}>{target && editing && <TransformControls object={target} mode={mode} size={.8}
      onMouseDown={() => useEditor.getState().checkpoint()}
      onObjectChange={() => {
        if (!selected) return;
        useEditor.getState().update(selected, { position: target.position.toArray(), rotation: [target.rotation.x, target.rotation.y, target.rotation.z], scale: target.scale.toArray().map(v => Math.max(.01, Math.min(20, v))) as [number, number, number] }, false);
      }} />}</group>
  </>;
}
