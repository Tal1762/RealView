import { useRef } from 'react';
import type { Point, Quad } from '../features/calibration/math';
import { validQuad, transformQuad } from '../features/calibration/math';
import { useEditor } from '../stores/editor';
import type { SurfaceObject } from '../features/scene/schema';
export type Placement = { kind: 'poster' | 'window'; asset: string; name: string; points: Point[] };
export function Calibration({ placement, setPlacement, report }: { placement: Placement | null; setPlacement: (value: Placement | null) => void; report: (message: string) => void }) {
  const scene = useEditor(s => s.scene), selected = useEditor(s => s.selected), editing = useEditor(s => s.editing);
  const modelSelected = scene.objects.some(object => object.id === selected && object.kind === 'model');
  const drag = useRef<{ id: string; corner: number; start: Point; corners: Quad } | null>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    return [scene.camera.mirrorPreview ? 1 - x : x, (event.clientY - rect.top) / rect.height];
  };
  const surfaces = scene.objects.filter((o): o is SurfaceObject => o.kind !== 'model' && o.visible);
  return <svg className={`calibration ${placement ? 'placing' : ''}`} viewBox="0 0 1000 562.5" preserveAspectRatio="none"
    onPointerDown={event => {
      if (!placement) return;
      const points = [...placement.points, point(event)];
      if (points.length < 4) { setPlacement({ ...placement, points }); return; }
      if (!validQuad(points as Quad)) { report('Choose four corners around the perimeter, without crossing edges. Try again.'); setPlacement({ ...placement, points: [] }); return; }
      const corners = scene.camera.mirrorPreview ? [points[1], points[0], points[3], points[2]] as Quad : points as Quad;
      useEditor.getState().add({ id: crypto.randomUUID(), kind: placement.kind, asset: placement.asset, name: placement.name, corners, visible: true, opacity: 1, frameColor: '#e3dbcd', frameWidth: .035 });
      setPlacement(null);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      const p = point(event), d = drag.current;
      const corners = d.corner < 0 ? transformQuad(d.corners, p[0] - d.start[0], p[1] - d.start[1]) : d.corners.map((v, i) => i === d.corner ? p : v) as Quad;
      if (validQuad(corners)) useEditor.getState().update(d.id, { corners }, false);
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {editing && !placement && !modelSelected && surfaces.map(object => <g key={object.id}>
      <polygon points={object.corners.map(([x, y]) => `${x * 1000},${y * 562.5}`).join(' ')} className={selected === object.id ? 'selected-quad' : 'hit-quad'}
        onPointerDown={event => {
          event.stopPropagation(); const svg = event.currentTarget.ownerSVGElement!;
          const rect = svg.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width;
          useEditor.getState().select(object.id); useEditor.getState().checkpoint();
          drag.current = { id: object.id, corner: -1, start: [scene.camera.mirrorPreview ? 1 - x : x, (event.clientY - rect.top) / rect.height], corners: structuredClone(object.corners) }; svg.setPointerCapture(event.pointerId);
        }} />
      {selected === object.id && object.corners.map(([x, y], i) => <circle key={i} cx={x * 1000} cy={y * 562.5} r={6} className="corner"
        onPointerDown={event => { event.stopPropagation(); useEditor.getState().checkpoint(); drag.current = { id: object.id, corner: i, start: [x, y], corners: structuredClone(object.corners) }; event.currentTarget.ownerSVGElement!.setPointerCapture(event.pointerId); }} />)}
    </g>)}
    {placement && <><polyline points={placement.points.map(([x, y]) => `${x * 1000},${y * 562.5}`).join(' ')} fill="none" stroke="#b5f2ca" strokeWidth="2" />{placement.points.map(([x, y], i) => <circle key={i} cx={x * 1000} cy={y * 562.5} r={6} className="placement-point" />)}</>}
  </svg>;
}
