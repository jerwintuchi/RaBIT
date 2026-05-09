import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Palette, Swatch, RGBA } from '../core/DataModel';
import { makePalette, makeSwatch } from '../core/DataModel';

const MAX_HISTORY = 16;

interface PaletteState {
  palette: Palette;
  primaryColor: RGBA;
  secondaryColor: RGBA;
  colorHistory: RGBA[];

  setPalette(palette: Palette): void;
  addSwatch(color: RGBA, name?: string): void;
  removeSwatch(index: number): void;
  updateSwatch(index: number, patch: Partial<Swatch>): void;
  reorderSwatches(fromIndex: number, toIndex: number): void;
  setPrimaryColor(color: RGBA): void;
  setSecondaryColor(color: RGBA): void;
  swapColors(): void;
  resetColors(): void;
  pushColorHistory(color: RGBA): void;
}

// Default: black primary, white secondary (as packed RGBA)
const BLACK: RGBA = 0x000000ff;
const WHITE: RGBA = 0xffffffff;

export const usePaletteStore = create<PaletteState>()(
  immer((set) => ({
    palette: makePalette({ name: 'Untitled Palette' }),
    primaryColor: BLACK,
    secondaryColor: WHITE,
    colorHistory: [],

    setPalette(palette) {
      set((s) => {
        s.palette = palette;
      });
    },

    addSwatch(color, name) {
      set((s) => {
        s.palette.swatches.push(makeSwatch(color, name ?? null));
      });
    },

    removeSwatch(index) {
      set((s) => {
        s.palette.swatches.splice(index, 1);
      });
    },

    updateSwatch(index, patch) {
      set((s) => {
        const sw = s.palette.swatches[index];
        if (sw) Object.assign(sw, patch);
      });
    },

    reorderSwatches(fromIndex, toIndex) {
      set((s) => {
        const [removed] = s.palette.swatches.splice(fromIndex, 1);
        if (removed) s.palette.swatches.splice(toIndex, 0, removed);
      });
    },

    setPrimaryColor(color) {
      set((s) => {
        s.primaryColor = color;
      });
    },

    setSecondaryColor(color) {
      set((s) => {
        s.secondaryColor = color;
      });
    },

    swapColors() {
      set((s) => {
        const tmp = s.primaryColor;
        s.primaryColor = s.secondaryColor;
        s.secondaryColor = tmp;
      });
    },

    resetColors() {
      set((s) => {
        s.primaryColor = BLACK;
        s.secondaryColor = WHITE;
      });
    },

    pushColorHistory(color) {
      set((s) => {
        const filtered = s.colorHistory.filter((c) => c !== color);
        s.colorHistory = [color, ...filtered].slice(0, MAX_HISTORY);
      });
    },
  })),
);
