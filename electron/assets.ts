import { createHash } from 'node:crypto';
import { extname } from 'node:path';

export function inspectAsset(bytes: Buffer, filename: string, kind: 'image' | 'model') {
  if (bytes.length > (kind === 'model' ? 100 : 25) * 1024 * 1024) throw new Error('Asset exceeds the import limit (images 25 MB, models 100 MB).');
  let ext = extname(filename).toLowerCase();
  if (ext === '.jpeg') ext = '.jpg';
  if (kind === 'image') {
    const png = ext === '.png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = ext === '.jpg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpg) throw new Error('Choose a valid PNG or JPEG image.');
  } else {
    if (ext !== '.glb' || bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Choose a self-contained glTF 2.0 binary (.glb).');
    const size = bytes.readUInt32LE(12);
    if (size > bytes.length - 20) throw new Error('Truncated GLB header.');
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + size));
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (key === 'uri' && (typeof value !== 'string' || !value.startsWith('data:'))) throw new Error('GLB must embed all textures and buffers. Export a self-contained GLB.');
        walk(value);
      }
    };
    walk(json);
    if (json.extensionsRequired?.some((e: string) => ['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression'].includes(e))) throw new Error('Compressed GLB is not supported yet. Export without Draco, Meshopt, or KTX2 compression.');
  }
  return `${createHash('sha256').update(bytes).digest('hex')}${ext}`;
}
