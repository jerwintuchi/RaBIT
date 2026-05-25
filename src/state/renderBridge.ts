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

export function setScratchErase(on: boolean): void {
  _engine?.setScratchErase(on);
}

export function setActiveLayerOnEngine(id: string): void {
  _engine?.setActiveLayer(id);
}

export function uploadLayerData(layerId: string, data: Uint8ClampedArray): void {
  _engine?.uploadLayerData(layerId, data);
}

export function readCompositePixel(canvasX: number, canvasY: number): [number, number, number, number] {
  return _engine?.readPixel(canvasX, canvasY) ?? [0, 0, 0, 0];
}

export function setOnionFrames(
  prev: (Uint8ClampedArray | null)[],
  next: (Uint8ClampedArray | null)[],
  opacity: number,
): void {
  _engine?.setOnionFrames(prev, next, opacity);
}

export function readAllCompositedPixels(): Uint8ClampedArray | null {
  return _engine?.readAllPixels() ?? null;
}

export function setEngineTileMode(on: boolean): void {
  _engine?.setTileMode(on);
}

export function setEngineMirrorMode(mode: { h: boolean; v: boolean }): void {
  _engine?.setMirrorMode(mode);
}

export function setEngineReferenceImage(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
): void {
  _engine?.setReferenceImage(pixels, w, h);
}

export function setEngineReferenceOpacity(v: number): void {
  _engine?.setReferenceOpacity(v);
}

export function setEngineReferenceVisible(v: boolean): void {
  _engine?.setReferenceVisible(v);
}

export function setEngineReferencePosition(x: number, y: number): void {
  _engine?.setReferencePosition(x, y);
}

export function clearEngineReference(): void {
  _engine?.clearReference();
}
