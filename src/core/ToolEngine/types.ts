import type { Command } from '../CommandSystem';
import type { LayerId, RGBA } from '../DataModel';

export type ToolId =
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'fill'
  | 'eyedropper'
  | 'hand'
  | 'zoom'
  | 'marquee'
  | 'lasso'
  | 'magic-wand';

export interface CursorDef {
  /** CSS cursor value (e.g. 'crosshair', 'grab') or 'pixel' for a custom 1px cursor. */
  type: string;
}

/** Normalized canvas-space pointer event handed to tools. */
export interface CanvasPointerEvent {
  canvasX: number; // floored canvas pixel X
  canvasY: number; // floored canvas pixel Y
  pressure: number; // 0..1, defaults to 1.0 if non-stylus
  button: 0 | 1 | 2;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
}

/** Side-effects available to tools — provided by the state-layer bridge. */
export interface ToolEngineContext {
  getActiveLayerId(): LayerId | null;
  /** True when the active layer is locked — tools should refuse to mutate it. */
  isActiveLayerLocked(): boolean;
  /** Returns the active frame's resolved pixel buffer for a layer (or null). */
  getLayerData(layerId: LayerId): Uint8ClampedArray | null;
  getCanvasSize(): { width: number; height: number };
  getPrimaryColor(): RGBA;
  setPrimaryColor(rgba: RGBA): void;
  /** Reads the composited pixel at canvas coordinates (eyedropper). */
  readCompositePixel(canvasX: number, canvasY: number): RGBA;

  /** Upload an in-progress stroke buffer to the GPU scratch texture. */
  updateScratch(data: Uint8ClampedArray): void;
  /** Clear the scratch GPU texture. */
  clearScratch(): void;

  /** Push a Command onto the undo/redo stack. */
  executeCommand(cmd: Command): void;

  /** Notify the renderer that a layer's pixel buffer was mutated in place. */
  notifyLayerChanged(layerId: LayerId, data: Uint8ClampedArray): void;

  /** Zoom one step in/out, keeping the given canvas point fixed under the cursor. */
  zoomToward(canvasX: number, canvasY: number, direction: 'in' | 'out'): void;
}

/** Common tool interface — see architecture.md §7. */
export interface Tool {
  readonly id: ToolId;
  readonly cursor: CursorDef;

  onPointerDown(e: CanvasPointerEvent): void;
  onPointerMove(e: CanvasPointerEvent): void;
  onPointerUp(e: CanvasPointerEvent): void;
  onKeyDown?(e: KeyboardEvent): void;
  onCancel(): void;
}
