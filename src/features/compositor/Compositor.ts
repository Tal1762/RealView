import * as T from 'three';
import type { Scene as RoomScene, SurfaceObject } from '../scene/schema';
import { assetUrl } from '../scene/schema';
import { homography, UNIT } from '../calibration/math';

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const surfaceFragment = `
uniform sampler2D picture; uniform mat3 inverseH; uniform float opacity; uniform float frameWidth; uniform vec3 frameColor;
varying vec2 vUv;
void main(){
 vec3 p=inverseH*vec3(vUv.x,1.-vUv.y,1.); vec2 uv=p.xy/p.z;
 if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) discard;
 vec4 color=texture2D(picture,vec2(uv.x,1.-uv.y));
 float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
 if(edge<frameWidth) color=vec4(frameColor,1.);
 gl_FragColor=vec4(color.rgb,color.a*opacity);
}`;
const compositeFragment = `
uniform sampler2D cameraImage; uniform sampler2D decorations; uniform sampler2D models; uniform sampler2D person;
uniform vec2 crop; uniform vec2 maskPixel; uniform float useMask; uniform float cameraReady;
varying vec2 vUv;
void main(){
 vec2 cameraUV=(vUv-.5)*crop+.5;
 vec4 room=texture2D(cameraImage,cameraUV);
 if(cameraReady<.5) room=vec4(.045,.055,.06,1.);
 vec4 wall=texture2D(decorations,vUv); vec4 model=texture2D(models,vUv);
 vec3 decorated=room.rgb*(1.-wall.a)+wall.rgb;
 decorated=decorated*(1.-model.a)+model.rgb;
 vec2 m=vec2(cameraUV.x,1.-cameraUV.y);
 float mask=texture2D(person,m).r*.4;
 mask+=(texture2D(person,m+vec2(maskPixel.x,0.)).r+texture2D(person,m-vec2(maskPixel.x,0.)).r+texture2D(person,m+vec2(0.,maskPixel.y)).r+texture2D(person,m-vec2(0.,maskPixel.y)).r)*.15;
 mask=smoothstep(.22,.78,mask)*useMask*cameraReady;
 gl_FragColor=vec4(mix(decorated,room.rgb,mask),1.);
}`;
export class Compositor {
  readonly renderer: T.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private camera = new T.Camera();
  private geometry = new T.PlaneGeometry(2, 2);
  private surfaces = new T.Scene();
  private finalScene = new T.Scene();
  private target = new T.WebGLRenderTarget(1280, 720, { depthBuffer: false });
  private videoTexture: T.VideoTexture;
  private modelTexture: T.CanvasTexture | null = null;
  private mask = new T.DataTexture(new Uint8Array([0]), 1, 1, T.RedFormat);
  private blank = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  private material: T.ShaderMaterial;
  private entries = new Map<string, { mesh: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>; asset: string; texture: T.Texture | null }>();
  private textures = new T.TextureLoader();
  private stopped = false;
  private lastMask = 0;
  private config: RoomScene | null = null;
  constructor(private video: HTMLVideoElement, private onError: (message: string) => void) {
    this.renderer = new T.WebGLRenderer({ alpha: false, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.setSize(1280, 720, false);
    this.renderer.outputColorSpace = T.LinearSRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    this.videoTexture = new T.VideoTexture(video);
    this.mask.needsUpdate = true; this.blank.needsUpdate = true;
    this.mask.minFilter = this.mask.magFilter = T.LinearFilter;
    this.material = new T.ShaderMaterial({ vertexShader: vertex, fragmentShader: compositeFragment, depthTest: false, depthWrite: false, uniforms: {
      cameraImage: { value: this.videoTexture }, decorations: { value: this.target.texture }, models: { value: this.blank }, person: { value: this.mask }, crop: { value: new T.Vector2(1, 1) }, maskPixel: { value: new T.Vector2(1, 1) }, useMask: { value: 0 }, cameraReady: { value: 0 },
    } });
    this.finalScene.add(new T.Mesh(this.geometry, this.material));
  }
  private contextLost = (event: Event) => { event.preventDefault(); this.onError('GPU context lost. Save your scene and restart RoomShift.'); };
  configure(scene: RoomScene) {
    this.config = scene;
    if (this.canvas.width !== scene.output.width || this.canvas.height !== scene.output.height) {
      this.renderer.setSize(scene.output.width, scene.output.height, false); this.target.setSize(scene.output.width, scene.output.height);
    }
    const ids = new Set(scene.objects.filter(o => o.kind !== 'model').map(o => o.id));
    for (const [id, entry] of this.entries) if (!ids.has(id)) { this.surfaces.remove(entry.mesh); entry.texture?.dispose(); entry.mesh.material.dispose(); this.entries.delete(id); }
    scene.objects.forEach((object, order) => { if (object.kind !== 'model') this.surface(object, order); });
  }
  private surface(object: SurfaceObject, order: number) {
    let entry = this.entries.get(object.id);
    if (!entry) {
      const material = new T.ShaderMaterial({ vertexShader: vertex, fragmentShader: surfaceFragment, transparent: true, depthTest: false, depthWrite: false, uniforms: { picture: { value: this.blank }, inverseH: { value: new T.Matrix3() }, opacity: { value: 1 }, frameWidth: { value: 0 }, frameColor: { value: new T.Color() } } });
      const mesh = new T.Mesh(this.geometry, material);
      entry = { mesh, asset: '', texture: null }; this.entries.set(object.id, entry); this.surfaces.add(mesh);
    }
    entry.mesh.visible = object.visible; entry.mesh.renderOrder = order;
    const u = entry.mesh.material.uniforms;
    u.inverseH.value.set(...homography(object.corners, UNIT) as [number, number, number, number, number, number, number, number, number]);
    u.opacity.value = object.opacity; u.frameWidth.value = object.kind === 'window' ? object.frameWidth : 0;
    u.frameColor.value.setStyle(object.frameColor, T.LinearSRGBColorSpace);
    if (entry.asset !== object.asset) {
      entry.texture?.dispose(); entry.texture = null; u.picture.value = this.blank; entry.asset = object.asset;
      const target = entry;
      this.textures.load(assetUrl(object.asset), texture => {
        if (this.stopped || this.entries.get(object.id) !== target || target.asset !== object.asset) { texture.dispose(); return; }
        target.texture = texture; u.picture.value = texture;
      }, undefined, () => this.onError(`Could not load “${object.name}”. Reimport the missing or invalid image.`));
    }
  }
  setMask(bytes: Uint8Array, width: number, height: number) {
    if (this.stopped) return;
    if (this.mask.image.width !== width || this.mask.image.height !== height) {
      this.mask.dispose(); this.mask = new T.DataTexture(bytes, width, height, T.RedFormat);
      this.mask.minFilter = this.mask.magFilter = T.LinearFilter;
      this.material.uniforms.person.value = this.mask;
    } else this.mask.image.data = bytes;
    this.mask.needsUpdate = true; this.lastMask = performance.now();
    this.material.uniforms.maskPixel.value.set(1 / width, 1 / height);
  }
  render(models: HTMLCanvasElement, cameraActive: boolean) {
    if (!this.config || this.stopped) return;
    if (!this.modelTexture || this.modelTexture.image !== models) {
      this.modelTexture?.dispose(); this.modelTexture = new T.CanvasTexture(models); this.modelTexture.flipY = true;
      this.material.uniforms.models.value = this.modelTexture;
    }
    this.modelTexture.needsUpdate = true;
    const aspect = (this.video.videoWidth || 16) / (this.video.videoHeight || 9), targetAspect = this.canvas.width / this.canvas.height;
    this.material.uniforms.crop.value.set(Math.min(1, targetAspect / aspect), Math.min(1, aspect / targetAspect));
    this.material.uniforms.cameraReady.value = cameraActive && this.video.readyState >= 2 ? 1 : 0;
    this.material.uniforms.useMask.value = this.config.output.segmentation && performance.now() - this.lastMask < 600 ? 1 : 0;
    this.renderer.setRenderTarget(this.target); this.renderer.setClearColor(0, 0); this.renderer.clear(); this.renderer.render(this.surfaces, this.camera);
    this.renderer.setRenderTarget(null); this.renderer.setClearColor(0, 1); this.renderer.render(this.finalScene, this.camera);
  }
  dispose() {
    this.stopped = true; this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.entries.forEach(e => { e.texture?.dispose(); e.mesh.material.dispose(); });
    this.entries.clear(); this.videoTexture.dispose(); this.modelTexture?.dispose(); this.mask.dispose(); this.blank.dispose();
    this.material.dispose(); this.geometry.dispose(); this.target.dispose(); this.renderer.dispose();
  }
}
