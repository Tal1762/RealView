import type { Scene } from '../features/scene/schema';
export type SceneSummary = Pick<Scene, 'id' | 'name' | 'modifiedAt'>;
export type Signal = { type: 'ready' | 'closed' | 'offer' | 'answer' | 'ice' | 'settings'; data?: unknown };
export interface RoomShiftAPI {
  importAsset(kind: 'image' | 'model'): Promise<{ asset: string; name: string } | null>;
  saveScene(scene: Scene): Promise<SceneSummary>;
  listScenes(): Promise<{ scenes: SceneSummary[]; invalid: number }>;
  loadScene(id: string): Promise<{ scene: Scene; missing: string[] }>;
  deleteScene(id: string): Promise<void>;
  openOutput(): Promise<void>;
  closeOutput(): Promise<void>;
  signal(message: Signal): void;
  onSignal(callback: (message: Signal) => void): () => void;
  obsStatus(): Promise<boolean>;
  openObsGuide(): Promise<void>;
}
declare global { interface Window { roomshift: RoomShiftAPI } }
