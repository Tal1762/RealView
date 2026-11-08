import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from 'lucide-react';
import { useEditor } from '../stores/editor';
import { transformQuad } from '../features/calibration/math';
import { Button } from './ui/button';
function NumberField({ label, value, onChange, step = .05, min = -100, max = 100 }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) {
  return <label className="number-field"><span>{label}</span><input aria-label={label} type="number" value={Number(value.toFixed(3))} step={step} min={min} max={max} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n >= min && n <= max) onChange(n); }} /></label>;
}
export function Inspector({ replaceImage }: { replaceImage: (id: string) => void }) {
  const selected = useEditor(s => s.selected), object = useEditor(s => s.scene.objects.find(o => o.id === s.selected));
  const update = useEditor(s => s.update);
  return <aside className="inspector panel"><div className="panel-heading">Properties <span className="eyebrow">INSPECTOR</span></div>
    {!object ? <div className="inspector-empty"><div className="empty-symbol">⌖</div><h3>Make it your own</h3><p>Select a decoration to fine-tune its placement, appearance, and perspective.</p><div className="tip"><b>A little perspective</b><p>Keep your camera fixed after placing decorations. Your room is the canvas.</p></div></div> : <>
      <div className="property-section"><span className="eyebrow">{object.kind === 'model' ? '3D OBJECT' : object.kind === 'window' ? 'VIRTUAL WINDOW' : 'WALL ART'}</span>
        <input className="object-name" aria-label="Object name" value={object.name} maxLength={120} onChange={e => { if (e.target.value) update(object.id, { name: e.target.value }); }} />
        <label className="toggle-row">Visible<input type="checkbox" checked={object.visible} onChange={e => update(object.id, { visible: e.target.checked })} /></label>
        <label className="range-label">Opacity <span>{Math.round(object.opacity * 100)}%</span><input aria-label="Opacity" type="range" min="0" max="1" step="0.01" value={object.opacity} onPointerDown={() => useEditor.getState().checkpoint()} onChange={e => update(object.id, { opacity: +e.target.value }, false)} /></label>
      </div>
      {object.kind === 'model' ? <>
        {(['position', 'rotation', 'scale'] as const).map(key => <div className="property-section" key={key}><h4>{key} {key === 'rotation' && <small>degrees</small>}</h4><div className="vector-fields">{object[key].map((value, index) => <NumberField key={index} label={`${key} ${'XYZ'[index]}`} value={key === 'rotation' ? value * 180 / Math.PI : value} step={key === 'rotation' ? 5 : .05} min={key === 'scale' ? .01 : -100} max={key === 'scale' ? 20 : key === 'rotation' ? 360 : 100} onChange={n => { const v = [...object[key]] as [number, number, number]; v[index] = key === 'rotation' ? n * Math.PI / 180 : n; update(object.id, { [key]: v }); }} />)}</div></div>)}
        <div className="property-section"><p className="hint">Drag the colored axes to transform. Camera is at the origin, looking down −Z. One normalized model unit is one scene unit.</p><Button onClick={() => update(object.id, { position: [0, 0, -3], rotation: [0, 0, 0], scale: [1, 1, 1] })}><RotateCcw size={14} /> Reset transform</Button></div>
      </> : <>
        <div className="property-section"><h4>Placement</h4><p className="hint">Drag the artwork to move it. Drag any corner to match your wall.</p><div className="button-pair"><Button onClick={() => update(object.id, { corners: transformQuad(object.corners, 0, 0, .9) })}>Smaller</Button><Button onClick={() => update(object.id, { corners: transformQuad(object.corners, 0, 0, 1.1) })}>Larger</Button></div><div className="button-pair"><Button onClick={() => update(object.id, { corners: transformQuad(object.corners, 0, 0, 1, -.05) })}>Rotate ↶</Button><Button onClick={() => update(object.id, { corners: transformQuad(object.corners, 0, 0, 1, .05) })}>Rotate ↷</Button></div>
          <Button className="full" onClick={() => replaceImage(object.id)}>Replace image</Button></div>
        {object.kind === 'window' && <div className="property-section"><h4>Window frame</h4><label className="toggle-row">Finish <input aria-label="Frame color" type="color" value={object.frameColor} onChange={e => update(object.id, { frameColor: e.target.value })} /></label><label className="range-label">Frame width<input aria-label="Frame width" type="range" min="0" max=".15" step=".005" value={object.frameWidth} onPointerDown={() => useEditor.getState().checkpoint()} onChange={e => update(object.id, { frameWidth: +e.target.value }, false)} /></label></div>}
        <div className="property-section"><h4>Perspective corners</h4>{object.corners.map((p, i) => <div className="corner-row" key={i}><span>{i + 1}</span>{p.map((v, axis) => <NumberField key={axis} label={`Corner ${i + 1} ${axis ? 'Y' : 'X'}`} value={v} step={.01} min={-4} max={5} onChange={n => { const corners = structuredClone(object.corners); corners[i][axis] = n; update(object.id, { corners }); }} />)}</div>)}</div>
      </>}
      <div className="property-section"><h4>Layer order</h4><div className="button-pair"><Button onClick={() => useEditor.getState().reorder(object.id, 1)}><ArrowUp size={14} /> Forward</Button><Button onClick={() => useEditor.getState().reorder(object.id, -1)}><ArrowDown size={14} /> Back</Button></div><Button variant="danger" className="full" onClick={() => selected && useEditor.getState().remove(selected)}><Trash2 size={14} /> Delete object</Button></div>
    </>}
  </aside>;
}
