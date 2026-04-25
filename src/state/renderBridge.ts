// Bridges the RenderingEngine (src/render/) into the state layer so UI can use it
// without violating the UI → State → Core layer rule.
import { RenderingEngine } from '../render';

// Re-export types the UI needs — UI imports these from state, not render directly.
export type { RenderLayerSpec, DirtyFlags } from '../render';
export { DirtyFlag } from '../render';

// Module-level singleton — the engine is imperative, not reactive state.
let _engine: RenderingEngine | null = null;

export function initEngine(canvas: HTMLCanvasElement): RenderingEngine {
  _engine = new RenderingEngine();
  _engine.init(canvas);
  return _engine;
}

export function getEngine(): RenderingEngine | null {
  return _engine;
}

export function disposeEngine(): void {
  _engine?.dispose();
  _engine = null;
}

export function updateScratch(data: Uint8ClampedArray): void {
  _engine?.updateScratch(data);
}

export function clearScratch(): void {
  _engine?.clearScratch();
}

export function uploadLayerData(layerId: string, data: Uint8ClampedArray): void {
  _engine?.uploadLayerData(layerId, data);
}

export function readCompositePixel(canvasX: number, canvasY: number): [number, number, number, number] {
  return _engine?.readPixel(canvasX, canvasY) ?? [0, 0, 0, 0];
}
