import { Compositor } from '../src/features/compositor/Compositor';
import { newScene } from '../src/features/scene/schema';
/** Pixel assertions execute against real WebGL in Electron, with deterministic masks. */
export async function checkCompositor() {
  const input = document.createElement('canvas'); input.width = 640; input.height = 360;
  const ctx = input.getContext('2d')!; ctx.fillStyle = '#104080'; ctx.fillRect(0, 0, 640, 360);
  let frame = 0;
  const paint = () => { ctx.fillRect(0, 0, 640, 360); frame = requestAnimationFrame(paint); };
  const video = document.createElement('video'); video.muted = true;
  const stream = input.captureStream(30); video.srcObject = stream;
  paint();
  await video.play(); await new Promise(r => setTimeout(r, 100));
  const errors: string[] = [], engine = new Compositor(video, error => errors.push(error));
  const scene = newScene(); scene.output.width = 640; scene.output.height = 360;
  scene.objects.push({ id: crypto.randomUUID(), kind: 'window', name: 'Test window', visible: true, opacity: 1, asset: 'builtin:coast', corners: [[.2, .2], [.8, .25], [.75, .8], [.25, .75]], frameColor: '#ff0000', frameWidth: .04 });
  const emptyModels = document.createElement('canvas'); emptyModels.width = 640; emptyModels.height = 360;
  engine.configure(scene);
  await new Promise(r => setTimeout(r, 300));
  const read = (x: number, y: number) => {
    const gl = engine.renderer.getContext(), bytes = new Uint8Array(4);
    gl.readPixels(Math.round(x * 640), Math.round((1 - y) * 360), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return [...bytes];
  };
  const close = (a: number[], b: number[], tolerance = 5) => a.every((v, i) => Math.abs(v - b[i]) < tolerance);
  const ensure = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  try {
    engine.setMask(new Uint8Array(16), 4, 4); engine.render(emptyModels, true);
    const outside = read(.05, .05), decorated = read(.5, .5), frame = read(.5, .236);
    ensure(close(outside, [16, 64, 128, 255]), `Camera color changed: ${outside}`);
    ensure(!close(decorated, outside), 'Decoration missing inside calibrated quad');
    ensure(frame[0] > 220 && frame[1] < 20, `Window frame color incorrect: ${frame}`);
    engine.setMask(new Uint8Array(16).fill(255), 4, 4); engine.render(emptyModels, true);
    const occluded = read(.5, .5); ensure(close(occluded, outside), `Foreground failed to occlude decoration: ${occluded}`);
    engine.setMask(new Uint8Array(16).fill(128), 4, 4); engine.render(emptyModels, true);
    const edge = read(.5, .5); ensure(!close(edge, outside) && !close(edge, decorated), 'Confidence mask edge did not blend');
    scene.output.segmentation = false; engine.configure(scene); engine.render(emptyModels, true);
    ensure(close(read(.5, .5), decorated), 'Occlusion toggle did not restore decoration');
    scene.objects[0].visible = false; engine.configure(scene); engine.render(emptyModels, true);
    ensure(close(read(.5, .5), outside), 'Hidden decoration still rendered');
    ensure(errors.length === 0, errors.join(';'));
    return { outside, decorated, frame, occluded, edge, passed: true };
  } finally { cancelAnimationFrame(frame); engine.dispose(); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; }
}
