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
  size: number; // px, 1–64
  opacity: number; // 0–1
  pixelPerfect: boolean;
}

export interface EraserOptions {
  size: number;
  opacity: number;
}

export interface FillOptions {
  tolerance: number; // 0–255
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

interface ToolState {
  activeTool: ToolId;
  previousTool: ToolId | null; // for Space-held hand-tool restore
  options: ToolOptions;
  selection: SelectionMask | null;

  setActiveTool(id: ToolId): void;
  setPreviousTool(id: ToolId | null): void;
  updateOptions<T extends ToolId>(tool: T, patch: Partial<ToolOptions[T]>): void;
  setSelection(mask: SelectionMask | null): void;
  clearSelection(): void;
  invertSelection(): void;
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
  })),
);
