import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from '../src/stores/editor';
import { newScene, type SceneObject } from '../src/features/scene/schema';
const object = (): SceneObject => ({ id: crypto.randomUUID(), kind: 'model', asset: 'builtin:plant', name: 'Plant', position: [0, 0, -3], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, opacity: 1 });
beforeEach(() => useEditor.getState().load(newScene()));
describe('editor transactions', () => {
  it('adds, selects, transforms, removes and undoes objects', () => {
    const a = object(), store = useEditor.getState(); store.add(a); expect(useEditor.getState().selected).toBe(a.id);
    store.update(a.id, { position: [1, 2, -4] }); store.remove(a.id); expect(useEditor.getState().scene.objects).toHaveLength(0);
    store.undo(); expect(useEditor.getState().scene.objects[0]).toMatchObject({ position: [1, 2, -4] });
    store.undo(); expect(useEditor.getState().scene.objects[0]).toMatchObject({ position: [0, 0, -3] });
    store.redo(); expect(useEditor.getState().scene.objects[0]).toMatchObject({ position: [1, 2, -4] });
  });
  it('groups drag changes into a single undo step and drops redo on a new edit', () => {
    const a = object(), store = useEditor.getState(); store.add(a); store.checkpoint();
    for (let i = 0; i < 20; i++) store.update(a.id, { position: [i, 0, -3] }, false);
    store.undo(); expect(useEditor.getState().scene.objects[0]).toMatchObject({ position: [0, 0, -3] });
    store.update(a.id, { visible: false }); expect(useEditor.getState().future).toHaveLength(0);
  });
  it('reorders layers and rejects malformed transforms', () => {
    const a = object(), b = object(), store = useEditor.getState(); store.add(a); store.add(b); store.reorder(a.id, 1);
    expect(useEditor.getState().scene.objects.map(o => o.id)).toEqual([b.id, a.id]);
    store.update(a.id, { scale: [0, -1, Infinity] }); expect(useEditor.getState().scene.objects[1]).toMatchObject({ scale: [1, 1, 1] });
  });
  it('does not clear dirty edits made while an asynchronous save was in flight', () => {
    const store = useEditor.getState(); const snapshot = store.scene; store.add(object()); store.saved(snapshot, new Date().toISOString()); expect(useEditor.getState().dirty).toBe(true);
  });
});
