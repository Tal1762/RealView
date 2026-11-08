import { create } from 'zustand';
import { newScene, sceneSchema, type Scene, type SceneObject } from '../features/scene/schema';
type Editor = {
  scene: Scene; selected: string | null; editing: boolean; past: Scene[]; future: Scene[]; dirty: boolean;
  apply: (recipe: (scene: Scene) => void, history?: boolean) => void;
  checkpoint: () => void; undo: () => void; redo: () => void;
  select: (id: string | null) => void; setEditing: (value: boolean) => void;
  load: (scene: Scene) => void; saved: (snapshot: Scene, modifiedAt: string) => void;
  add: (object: SceneObject) => void; update: (id: string, patch: Partial<SceneObject>, history?: boolean) => void;
  remove: (id: string) => void; reorder: (id: string, direction: number) => void;
};
const clone = (s: Scene) => structuredClone(s);
export const useEditor = create<Editor>((set, get) => ({
  scene: newScene(), selected: null, editing: true, past: [], future: [], dirty: false,
  apply: (recipe, history = true) => {
    const current = get(), next = clone(current.scene);
    recipe(next);
    const result = sceneSchema.safeParse(next);
    if (!result.success) return;
    set({ scene: result.data, dirty: true, ...(history ? { past: [...current.past.slice(-49), current.scene], future: [] } : {}) });
  },
  checkpoint: () => set(s => ({ past: [...s.past.slice(-49), clone(s.scene)], future: [] })),
  undo: () => set(s => !s.past.length ? {} : { scene: s.past.at(-1)!, past: s.past.slice(0, -1), future: [s.scene, ...s.future], dirty: true }),
  redo: () => set(s => !s.future.length ? {} : { scene: s.future[0], past: [...s.past, s.scene], future: s.future.slice(1), dirty: true }),
  select: selected => set({ selected }), setEditing: editing => set({ editing }),
  load: scene => set({ scene: sceneSchema.parse(scene), selected: null, past: [], future: [], dirty: false }),
  saved: (snapshot, modifiedAt) => { if (get().scene === snapshot) set({ scene: { ...snapshot, modifiedAt }, dirty: false }); },
  add: object => { get().apply(s => { s.objects.push(object); }); set({ selected: object.id }); },
  update: (id, patch, history = true) => get().apply(s => { const index = s.objects.findIndex(o => o.id === id); if (index >= 0) s.objects[index] = { ...s.objects[index], ...patch } as SceneObject; }, history),
  remove: id => { get().apply(s => { s.objects = s.objects.filter(o => o.id !== id); }); set({ selected: null }); },
  reorder: (id, direction) => get().apply(s => { const i = s.objects.findIndex(o => o.id === id), j = i + direction; if (i >= 0 && j >= 0 && j < s.objects.length) [s.objects[i], s.objects[j]] = [s.objects[j], s.objects[i]]; }),
}));
