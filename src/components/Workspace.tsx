import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Move, RotateCw, Maximize2, CameraOff, X, Scan } from 'lucide-react';
import { Compositor } from '../features/compositor/Compositor';
import { ModelStage } from '../features/compositor/ModelStage';
import { Segmenter } from '../features/segmentation/Segmenter';
import { publishCanvas } from '../features/output/bridge';
import { useEditor } from '../stores/editor';
import { Calibration, type Placement } from './Calibration';
import { Button } from './ui/button';
export class RenderBoundary extends Component<{ children: ReactNode; report: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.report(`Rendering failed: ${error.message}. Save your scene and restart RoomShift.`); }
  render() { return this.state.failed ? <div className="render-error">WebGL rendering unavailable. Update your graphics driver and restart RoomShift.</div> : this.props.children; }
}
export function Workspace({ video, active, cameraStatus, retry, placement, setPlacement, report, setSegmentationStatus, setOutputStatus, diagnostics }: {
  video: HTMLVideoElement; active: boolean; cameraStatus: string; retry: () => void; placement: Placement | null;
  setPlacement: (v: Placement | null) => void; report: (v: string) => void; setSegmentationStatus: (v: string) => void; setOutputStatus: (v: string) => void; diagnostics: (fps: number, ms: number) => void;
}) {
  const scene = useEditor(s => s.scene), editing = useEditor(s => s.editing);
  const selected = useEditor(s => s.scene.objects.find(o => o.id === s.selected));
  const host = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(1280);
  const [engine, setEngine] = useState<Compositor | null>(null), [segmenter, setSegmenter] = useState<Segmenter | null>(null);
  const [mode, setMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const stableReport = useCallback((message: string) => report(message), [report]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setStageWidth(entries[0].contentRect.width));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let compositor: Compositor;
    try { compositor = new Compositor(video, stableReport); host.current!.append(compositor.canvas); setEngine(compositor); }
    catch (error) { report(`WebGL unavailable: ${String(error)}. Update your graphics driver and restart.`); return; }
    return () => { compositor.canvas.remove(); compositor.dispose(); };
  }, [video, stableReport, report]);
  useEffect(() => { engine?.configure(scene); }, [engine, scene]);
  useEffect(() => {
    if (!engine || !scene.output.segmentation || !active) { setSegmentationStatus(scene.output.segmentation ? 'Waiting for camera' : 'Occlusion off'); setSegmenter(null); return; }
    const processor = new Segmenter((bytes, w, h) => engine.setMask(bytes, w, h), setSegmentationStatus);
    setSegmenter(processor);
    return () => processor.dispose();
  }, [engine, scene.output.segmentation, active, setSegmentationStatus]);
  useEffect(() => {
    if (!engine) return;
    return publishCanvas(engine.canvas, 30, () => useEditor.getState().scene.camera.mirrorOutput, setOutputStatus);
  }, [engine, setOutputStatus]);
  useEffect(() => { window.roomshift.signal({ type: 'settings', data: { mirror: scene.camera.mirrorOutput } }); }, [scene.camera.mirrorOutput]);
  return <main className="workspace"><div className="workspace-heading"><div><span className="eyebrow">YOUR SPACE, REIMAGINED</span><h1>Room studio<span className="beta-badge">BETA</span></h1></div><span className="privacy-pill"><span /> On-device. Always.</span></div>
    <div className="workspace-body"><div className="stage-topline"><span><span className={`status-dot ${active ? 'live' : ''}`} />{active ? 'LIVE PREVIEW' : 'CAMERA PREVIEW'}</span><span>{scene.output.width} × {scene.output.height} <span className="muted">/</span> {scene.camera.mirrorPreview ? 'Mirrored' : 'Original'}</span></div>
      <div className="stage" data-testid="stage">
        <div ref={host} className={`composite ${scene.camera.mirrorPreview ? 'mirror' : ''}`} data-testid="composite" />
        {engine && <div className="model-stage"><RenderBoundary report={report}><Canvas dpr={scene.output.width / Math.max(1, stageWidth)} camera={{ position: [0, 0, 0], fov: scene.camera.fov, near: .01, far: 200 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => { if (!placement) useEditor.getState().select(null); }}>
          <ModelStage engine={engine} video={video} active={active} segmenter={segmenter} report={stableReport} diagnostics={diagnostics} mode={mode} />
        </Canvas></RenderBoundary></div>}
        {editing && <div className={`calibration-wrap ${scene.camera.mirrorPreview ? 'mirror' : ''}`}><Calibration placement={placement} setPlacement={setPlacement} report={report} /></div>}
        {!active && <div className="camera-empty"><CameraOff size={28} /><h2>Your room starts here</h2><p>{cameraStatus}</p><Button onClick={retry}>Retry camera</Button></div>}
        {active && <span className="canvas-brand">roomshift<span>●</span></span>}
      </div>
      <div className="stage-bottomline"><span><Scan size={14} />{placement ? `Click corner ${placement.points.length + 1} of 4, following the perimeter.` : editing ? 'Keep your camera still. Make your room yours.' : 'Preview mode · editor controls hidden'}</span>{placement && <Button variant="ghost" size="small" onClick={() => setPlacement(null)}><X size={14} /> Cancel</Button>}</div>
      {editing && selected?.kind === 'model' && <div className="transform-bar">{([{ key: 'translate', label: 'Move', icon: Move }, { key: 'rotate', label: 'Rotate', icon: RotateCw }, { key: 'scale', label: 'Scale', icon: Maximize2 }] as const).map(({ key, label, icon: Icon }) => <Button key={key} variant={mode === key ? 'primary' : 'ghost'} onClick={() => setMode(key)}><Icon size={15} />{label}</Button>)}</div>}
      <div className="workspace-tip"><span className="tip-index">01 /</span><div><b>A new backdrop. Still your room.</b><p>Add artwork, open a window to somewhere new, or bring in a 3D object. You stay in front.</p></div></div>
    </div>
  </main>;
}
