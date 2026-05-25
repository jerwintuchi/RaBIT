import type { Command } from '../CommandSystem';
import type { LayerId, RGBA } from '../DataModel';

export interface SelectionMask {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  bounds: { x: number; y: number; w: number; h: number };
  inverted?: boolean;
}

export function isInSelection(sel: SelectionMask | null, x: number, y: number): boolean {
  if (!sel) return true;
  let inside: boolean;
  if (x < sel.bounds.x || y < sel.bounds.y ||
      x >= sel.bounds.x + sel.bounds.w ||
      y >= sel.bounds.y + sel.bounds.h) {
    inside = false;
  } else if (sel.data.length > 1) {
    inside = sel.data[y * sel.width + x] === 1;
  } else {
    inside = true;
  }
  return sel.inverted ? !inside : inside;
}

export type ToolId =
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'fill'
  | 'eyedropper'
  | 'hand'
  | 'zoom'
  | 'move'
  | 'marquee'
  | 'lasso'
  | 'magic-wand';

export interface CursorDef {
  type: string;
}

export interface CanvasPointerEvent {
  canvasX: number;
  canvasY: number;
  pressure: number;
  button: 0 | 1 | 2;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export interface ToolEngineContext {
  getActiveLayerId(): LayerId | null;
  isActiveLayerLocked(): boolean;
  getLayerData(layerId: LayerId): Uint8ClampedArray | null;
  getCanvasSize(): { width: number; height: number };
  getPrimaryColor(): RGBA;
  setPrimaryColor(rgba: RGBA): void;
  readCompositePixel(canvasX: number, canvasY: number): RGBA;
  updateScratch(data: Uint8ClampedArray): void;
  clearScratch(): void;
  setScratchErase(on: boolean): void;
  executeCommand(cmd: Command): void;
  notifyLayerChanged(layerId: LayerId, data: Uint8ClampedArray): void;
  previewLayerOnGPU(layerId: LayerId, data: Uint8ClampedArray): void;
  zoomToward(canvasX: number, canvasY: number, direction: 'in' | 'out'): void;
  getSelection(): SelectionMask | null;
  setSelection(mask: SelectionMask | null): void;
  clearSelection(): void;
  setSelectionDragOffset(offset: { dx: number; dy: number } | null): void;
  getPixelPerfect(): boolean;
  getFillTolerance(): number;
  getMagicWandTolerance(): number;
  getCompositedPixels(): Uint8ClampedArray | null;
  computeSelectionRust(x: number, y: number, tolerance: number): Promise<SelectionMask | null>;
  /** Returns the current mirror mode flags. */
  getMirrorMode(): { h: boolean; v: boolean };
  /** Sets the lasso tool's in-progress path for SVG overlay rendering. Pass [] to clear. */
  setLassoPreviewPath(path: Array<{ x: number; y: number }>): void;
}

export interface Tool {
  readonly id: ToolId;
  readonly cursor: CursorDef;
  onPointerDown(e: CanvasPointerEvent): void;
  onPointerMove(e: CanvasPointerEvent): void;
  onPointerUp(e: CanvasPointerEvent): void;
  onKeyDown?(e: KeyboardEvent): void;
  onCancel(): void;
  /** Called when the tool is switched away from. Should commit any pending
   *  floating-selection state rather than discarding it. */
  onDeactivate?(): void;
}
