import { mkdir, readFile, writeFile, rename, readdir, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { sceneSchema, serializeScene, deserializeScene, type Scene } from '../src/features/scene/schema';

export class SceneStorage {
  constructor(readonly root: string) {}
  private file(id: string) { return join(this.root, 'scenes', `${z.string().uuid().parse(id)}.json`); }
  async init() { await mkdir(join(this.root, 'scenes'), { recursive: true }); await mkdir(join(this.root, 'assets'), { recursive: true }); }
  async save(value: unknown) {
    const scene = sceneSchema.parse(value);
    scene.modifiedAt = new Date().toISOString();
    const target = this.file(scene.id), temp = `${target}.${crypto.randomUUID()}.tmp`;
    try { await writeFile(temp, serializeScene(scene), { flag: 'wx' }); await rename(temp, target); }
    finally { await unlink(temp).catch(() => {}); }
    return { id: scene.id, name: scene.name, modifiedAt: scene.modifiedAt };
  }
  async list() {
    const scenes: Pick<Scene, 'id' | 'name' | 'modifiedAt'>[] = [];
    let invalid = 0;
    for (const file of await readdir(join(this.root, 'scenes'))) {
      if (!file.endsWith('.json')) continue;
      try {
        const scene = deserializeScene(await readFile(join(this.root, 'scenes', file), 'utf8'));
        if (file !== `${scene.id}.json`) throw new Error('Scene ID mismatch');
        scenes.push({ id: scene.id, name: scene.name, modifiedAt: scene.modifiedAt });
      } catch { invalid++; }
    }
    return { scenes: scenes.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)), invalid };
  }
  async load(id: string) {
    const scene = deserializeScene(await readFile(this.file(id), 'utf8'));
    if (scene.id !== id) throw new Error('Scene ID mismatch');
    const missing: string[] = [];
    for (const asset of new Set(scene.objects.map(o => o.asset))) {
      if (!asset.startsWith('builtin:')) await access(join(this.root, 'assets', asset)).catch(() => missing.push(asset));
    }
    return { scene, missing };
  }
  async delete(id: string) { await unlink(this.file(id)); }
}
