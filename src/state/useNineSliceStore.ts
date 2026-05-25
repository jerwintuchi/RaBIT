import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface NineSliceMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface NineSliceState {
  visible: boolean;
  margins: NineSliceMargins;
  targetW: number;
  targetH: number;
  setVisible(v: boolean): void;
  setMargin(side: 'top' | 'right' | 'bottom' | 'left', px: number): void;
  setTargetSize(w: number, h: number): void;
}

export const useNineSliceStore = create<NineSliceState>()(
  immer((set) => ({
    visible: false,
    margins: { top: 8, right: 8, bottom: 8, left: 8 },
    targetW: 128,
    targetH: 128,

    setVisible(v) {
      set((s) => { s.visible = v; });
    },

    setMargin(side, px) {
      set((s) => { s.margins[side] = px; });
    },

    setTargetSize(w, h) {
      set((s) => {
        s.targetW = w;
        s.targetH = h;
      });
    },
  })),
);
