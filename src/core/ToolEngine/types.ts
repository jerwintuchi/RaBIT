import type { Command } from '../CommandSystem';
import type { LayerId, RGBA } from '../DataModel';

// ── Selection ─────────────────────────────────────────────────────────────────

/** Per-pixel selection mask — defined here in core so tools don't import from state. */
export interface SelectionMask {
  data: Uint8ClampedArray; // 1-bit per pixel in a byte array
  width: number;
  height: number;
  /** Canvas-space bounding rect of the selection (for overlay rendering). */
  bounds: { x: number; y: number; w: number; h: number };
  /** When true, tools operate OUTSIDE the mask rather than inside. */
  inverted?: boolean;
}

/**
 * Returns true if (x, y) is within the active selection, or if there is no selection.
 * Uses the per-pixel mask when available; falls back to bounds-only for draft marquee drags.
 */
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
  /**
   * When true, the scratch overlay uses DST_OUT blending so opaque scratch
   * pixels "punch through" the composite to show the checkerboard — giving
   * real-time eraser preview. Set false to restore normal SRC_OVER scratch.
   */
  setScratchErase(on: boolean): void;

  /** Push a Command onto the undo/redo stack. */
  executeCommand(cmd: Command): void;

  /** Notify the renderer that a layer's pixel buffer was mutated in place. */
  notifyLayerChanged(layerId: LayerId, data: Uint8ClampedArray): void;

  /**
   * Upload pixel data to the GPU for a layer WITHOUT touching the store or
   * data-version counter. Used by move-mode preview so the selection pixels
   * disappear from their original position while the user drags them.
   */
  previewLayerOnGPU(layerId: LayerId, data: Uint8ClampedArray): void;

  /** Zoom one step in/out, keeping the given canvas point fixed under the cursor. */
  zoomToward(canvasX: number, canvasY: number, direction: 'in' | 'out'): void;

  /** Returns the current selection mask, or null if nothing is selected. */
  getSelection(): SelectionMask | null;
  /** Update the selection mask (e.g. after a move operation). */
  setSelection(mask: SelectionMask | null): void;
  /** Clear the active selection. */
  clearSelection(): void;
  /** Returns the flood-fill tolerance (0–255). */
  getFillTolerance(): number;
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
