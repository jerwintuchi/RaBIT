import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { isInSelection } from '../core/ToolEngine/types';
import type { SelectionMask } from '../core/ToolEngine/types';
export type { SelectionMask } from '../core/ToolEngine/types';
export { isInSelection };

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

export interface PencilOptions {
  size: number;
  opacity: number;
  pixelPerfect: boolean;
}

export interface EraserOptions {
  size: number;
  opacity: number;
}

export interface FillOptions {
  tolerance: number;
  contiguous: boolean;
}

export interface LineOptions {
  size: number;
}

export interface ZoomOptions {
  mode: 'in' | 'out';
}

export type ToolOptions = {
  pencil: PencilOptions;
  eraser: EraserOptions;
  fill: FillOptions;
  line: LineOptions;
  zoom: ZoomOptions;
  eyedropper: Record<string, never>;
  hand: Record<string, never>;
  rectangle: Record<string, never>;
  ellipse: Record<string, never>;
  move: Record<string, never>;
  marquee: Record<string, never>;
  lasso: Record<string, never>;
  'magic-wand': { tolerance: number };
};

export interface SelectionClipboard {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

interface ToolState {
  activeTool: ToolId;
  previousTool: ToolId | null;
  options: ToolOptions;
  selection: SelectionMask | null;
  /** Pixel offset applied to the marching-ants overlay while a move drag is in
   *  progress. The SelectionMask itself stays frozen; only the visual changes. */
  selectionDragOffset: { dx: number; dy: number } | null;
  selectionClipboard: SelectionClipboard | null;
  mirrorMode: { h: boolean; v: boolean };
  /** Canvas-coordinate path points for the lasso tool's in-progress outline. */
  lassoPreviewPath: Array<{ x: number; y: number }>;

  setActiveTool(id: ToolId): void;
  setPreviousTool(id: ToolId | null): void;
  updateOptions<T extends ToolId>(tool: T, patch: Partial<ToolOptions[T]>): void;
  setSelection(mask: SelectionMask | null): void;
  clearSelection(): void;
  invertSelection(): void;
  setSelectionDragOffset(offset: { dx: number; dy: number } | null): void;
  setSelectionClipboard(cb: SelectionClipboard | null): void;
  setMirrorMode(mode: Partial<{ h: boolean; v: boolean }>): void;
  setLassoPreviewPath(path: Array<{ x: number; y: number }>): void;
}

const defaultOptions: ToolOptions = {
  pencil: { size: 1, opacity: 1, pixelPerfect: true },
  eraser: { size: 1, opacity: 1 },
  fill: { tolerance: 0, contiguous: true },
  line: { size: 1 },
  zoom: { mode: 'in' },
  eyedropper: {},
  hand: {},
  rectangle: {},
  ellipse: {},
  move: {},
  marquee: {},
  lasso: {},
  'magic-wand': { tolerance: 32 },
};

export const useToolStore = create<ToolState>()(
  immer((set) => ({
    activeTool: 'pencil',
    previousTool: null,
    options: defaultOptions,
    selection: null,
    selectionDragOffset: null,
    selectionClipboard: null,
    mirrorMode: { h: false, v: false },
    lassoPreviewPath: [],

    setActiveTool(id) {
      set((s) => {
        s.activeTool = id;
      });
    },

    setPreviousTool(id) {
      set((s) => {
        s.previousTool = id;
      });
    },

    updateOptions(tool, patch) {
      set((s) => {
        Object.assign(s.options[tool], patch);
      });
    },

    setSelection(mask) {
      set((s) => {
        s.selection = mask;
      });
    },

    clearSelection() {
      set((s) => {
        s.selection = null;
      });
    },

    invertSelection() {
      set((s) => {
        if (s.selection) s.selection.inverted = !s.selection.inverted;
      });
    },

    setSelectionDragOffset(offset) {
      set((s) => {
        s.selectionDragOffset = offset;
      });
    },

    setSelectionClipboard(cb) {
      set((s) => {
        s.selectionClipboard = cb;
      });
    },

    setMirrorMode(mode) {
      set((s) => {
        Object.assign(s.mirrorMode, mode);
      });
    },

    setLassoPreviewPath(path) {
      set((s) => {
        s.lassoPreviewPath = path;
      });
    },
  })),
);
