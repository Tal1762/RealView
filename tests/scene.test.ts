import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { newScene, serializeScene, deserializeScene, sceneSchema, assetSchema, type SceneObject } from '../src/features/scene/schema';
import { SceneStorage } from '../electron/storage';
import { inspectAsset } from '../electron/assets';
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const poster = (): SceneObject => ({ id: crypto.randomUUID(), name: 'Poster', kind: 'poster', visible: true, opacity: .8, corners: [[.1, .1], [.6, .15], [.6, .7], [.1, .8]], asset: 'builtin:art', frameColor: '#ffffff', frameWidth: .03 });
describe('scene persistence', () => {
  it('roundtrips calibrated objects, transforms, camera and timestamps', () => {
    const scene = newScene(); scene.objects.push(poster(), { id: crypto.randomUUID(), name: 'Plant', kind: 'model', visible: true, opacity: 1, asset: 'builtin:plant', position: [1, 2, -3], rotation: [.1, .2, .3], scale: [2, 2, 2] });
    expect(deserializeScene(serializeScene(scene))).toEqual(scene);
  });
  it('rejects unsupported versions, invalid numbers, duplicate IDs and resolution pairs', () => {
    const scene = newScene(); expect(sceneSchema.safeParse({ ...scene, version: 2 }).success).toBe(false);
    const obj = poster(); scene.objects = [obj, obj]; expect(sceneSchema.safeParse(scene).success).toBe(false);
    scene.objects = [{ ...obj, opacity: NaN }]; expect(sceneSchema.safeParse(scene).success).toBe(false);
    scene.objects = []; scene.output.height = 1080; expect(sceneSchema.safeParse(scene).success).toBe(false);
    expect(() => deserializeScene('broken')).toThrow();
  });
  it('rejects filesystem paths and remote asset references', () => {
    for (const path of ['../../secrets.png', 'https://example.com/a.png', 'C:\\private.png', 'builtin:unknown', 'a'.repeat(64) + '.svg']) expect(assetSchema.safeParse(path).success).toBe(false);
    expect(assetSchema.safeParse('a'.repeat(64) + '.glb').success).toBe(true);
  });
  it('saves atomically, reloads, reports missing assets, skips corruption and deletes', async () => {
    await mkdir('.local-test', { recursive: true });
    const root = await mkdtemp(resolve('.local-test', 'unit-')); roots.push(root);
    const store = new SceneStorage(root); await store.init(); const scene = newScene();
    const obj = poster(); obj.asset = 'a'.repeat(64) + '.png'; scene.objects.push(obj);
    await store.save(scene); scene.name = 'Renamed room'; await store.save(scene);
    const loaded = await store.load(scene.id); expect(loaded.scene.name).toBe('Renamed room'); expect(loaded.missing).toEqual([obj.asset]);
    await writeFile(join(root, 'scenes', 'damaged.json'), '{');
    expect((await store.list()).invalid).toBe(1); expect((await store.list()).scenes).toHaveLength(1);
    await expect(store.load('../../outside')).rejects.toThrow(); await store.delete(scene.id); expect((await store.list()).scenes).toHaveLength(0);
  });
});
function glb(json: unknown) {
  let text = JSON.stringify(json); text += ' '.repeat((4 - text.length % 4) % 4);
  const bytes = Buffer.alloc(20 + text.length); bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(text.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); bytes.write(text, 20); return bytes;
}
describe('managed assets', () => {
  it('accepts embedded GLB and creates content-addressed references', () => {
    const bytes = glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }] });
    expect(inspectAsset(bytes, 'model.glb', 'model')).toMatch(/^[a-f0-9]{64}\.glb$/);
    expect(inspectAsset(bytes, 'renamed.glb', 'model')).toEqual(inspectAsset(bytes, 'model.glb', 'model'));
  });
  it('rejects external GLB textures, invalid binaries and unsupported compression', () => {
    expect(() => inspectAsset(glb({ images: [{ uri: '../texture.png' }] }), 'model.glb', 'model')).toThrow('embed');
    expect(() => inspectAsset(glb({ extensionsRequired: ['KHR_draco_mesh_compression'] }), 'model.glb', 'model')).toThrow('Compressed');
    expect(() => inspectAsset(Buffer.from('bad'), 'model.glb', 'model')).toThrow();
    expect(() => inspectAsset(Buffer.from('not a png'), 'photo.png', 'image')).toThrow();
  });
});
