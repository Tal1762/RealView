import { z } from 'zod';
import { validQuad } from '../calibration/math';
const finite = z.number().finite();
const point = z.tuple([finite.min(-4).max(5), finite.min(-4).max(5)]);
export const quadSchema = z.tuple([point, point, point, point]).refine(validQuad, 'Corners must form a convex quadrilateral');
export const assetSchema = z.string().regex(/^(?:builtin:(?:art|coast)|[a-f0-9]{64}\.(?:png|jpg|glb))$/);
const common = { id: z.string().uuid(), name: z.string().min(1).max(120), visible: z.boolean(), opacity: finite.min(0).max(1) };
const surface = { ...common, asset: assetSchema.refine(a => !a.endsWith('.glb'), 'Surface requires an image'), corners: quadSchema, frameColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), frameWidth: finite.min(0).max(0.2) };
const vector = z.tuple([finite.min(-100).max(100), finite.min(-100).max(100), finite.min(-100).max(100)]);
export const objectSchema = z.discriminatedUnion('kind', [
  z.object({ ...surface, kind: z.literal('poster') }),
  z.object({ ...surface, kind: z.literal('window') }),
  z.object({ ...common, kind: z.literal('model'), asset: z.union([z.string().regex(/^[a-f0-9]{64}\.glb$/), z.enum(['builtin:plant', 'builtin:sculpture'])]), position: vector, rotation: vector, scale: z.tuple([finite.min(.01).max(20), finite.min(.01).max(20), finite.min(.01).max(20)]) }),
]);
export const sceneSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), name: z.string().min(1).max(120).refine(name => name.trim().length > 0, 'Scene name cannot be blank'),
  createdAt: z.iso.datetime(), modifiedAt: z.iso.datetime(),
  camera: z.object({ deviceId: z.string().max(1024), mirrorPreview: z.boolean(), mirrorOutput: z.boolean(), fov: finite.min(25).max(100) }),
  output: z.object({ width: z.union([z.literal(1280), z.literal(1920), z.literal(640)]), height: z.union([z.literal(720), z.literal(1080), z.literal(360)]), fps: z.union([z.literal(15), z.literal(24), z.literal(30)]), segmentation: z.boolean(), quality: z.enum(['fast', 'balanced', 'quality']) }).refine(o => o.width / o.height === 16 / 9, 'Output must be 16:9'),
  objects: z.array(objectSchema).max(100).refine(objects => new Set(objects.map(o => o.id)).size === objects.length, 'Duplicate object IDs'),
});
export type Scene = z.infer<typeof sceneSchema>;
export type SceneObject = z.infer<typeof objectSchema>;
export type SurfaceObject = Extract<SceneObject, { kind: 'poster' | 'window' }>;
export type ModelObject = Extract<SceneObject, { kind: 'model' }>;
export function newScene(): Scene {
  const now = new Date().toISOString();
  return { version: 1, id: crypto.randomUUID(), name: 'My room', createdAt: now, modifiedAt: now, camera: { deviceId: '', mirrorPreview: true, mirrorOutput: false, fov: 50 }, output: { width: 1280, height: 720, fps: 30, segmentation: true, quality: 'balanced' }, objects: [] };
}
export function assetUrl(asset: string): string {
  if (asset === 'builtin:art') return new URL('assets/art.svg', document.baseURI).href;
  if (asset === 'builtin:coast') return new URL('assets/coast.svg', document.baseURI).href;
  if (!assetSchema.safeParse(asset).success || asset.startsWith('builtin:')) throw new Error('Invalid asset reference');
  return `roomshift://assets/${asset}`;
}
export function serializeScene(scene: Scene): string { return JSON.stringify(sceneSchema.parse(scene), null, 2); }
export function deserializeScene(json: string): Scene { return sceneSchema.parse(JSON.parse(json)); }
