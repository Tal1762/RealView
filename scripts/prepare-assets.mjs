import { mkdir, cp, access, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import './licenses.mjs';
await build({ entryPoints: ['src/features/segmentation/worker.ts'], bundle: true, platform: 'browser', format: 'iife', target: 'es2022', outfile: 'public/assets/segmentation-worker.js' });
const dir = new URL('../public/assets/mediapipe/', import.meta.url);
await mkdir(dir, { recursive: true });
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', dir), { recursive: true });
const url = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
const path = new URL('selfie_segmenter.tflite', dir);
try { await access(path); } catch {
  console.log('Downloading the offline MediaPipe Selfie Segmenter model…');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100000 || bytes.toString('ascii', 4, 8) !== 'TFL3') throw new Error('Invalid model response');
  await writeFile(path, bytes);
}
const hash = createHash('sha256').update(await readFile(path)).digest('hex');
if (hash !== '191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b') throw new Error('Segmentation model checksum mismatch. Remove the cached model and retry.');
await writeFile(new URL('manifest.json', dir), JSON.stringify({ url, sha256: hash, license: 'Apache-2.0', purpose: 'Local person segmentation. No runtime network access.' }, null, 2));
