import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function createImportFixtures(directory) {
  await mkdir(directory, { recursive: true });
  // Self-contained tetrahedron, intentionally independent of Three's exporter.
  const vertices = new Float32Array([0,.8,0, -.5,-.4,.4, .5,-.4,.4, 0,.8,0, .5,-.4,.4, 0,-.4,-.5, 0,.8,0, 0,-.4,-.5, -.5,-.4,.4, -.5,-.4,.4, 0,-.4,-.5, .5,-.4,.4]);
  const bin = Buffer.from(vertices.buffer);
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [.8, .3, .15, 1], metallicFactor: .1, roughnessFactor: .6 }, doubleSided: true }], buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteLength: bin.length, target: 34962 }], accessors: [{ bufferView: 0, componentType: 5126, count: 12, type: 'VEC3', min: [-.5, -.4, -.5], max: [.5, .8, .4] }] };
  let text = JSON.stringify(json); text += ' '.repeat((4 - text.length % 4) % 4);
  const bytes = Buffer.alloc(28 + text.length + bin.length);
  bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(text.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); bytes.write(text, 20);
  bytes.writeUInt32LE(bin.length, 20 + text.length); bytes.writeUInt32LE(0x004e4942, 24 + text.length); bin.copy(bytes, 28 + text.length);
  const model = resolve(directory, 'Imported pyramid.glb'); await writeFile(model, bytes);
  return { model };
}
