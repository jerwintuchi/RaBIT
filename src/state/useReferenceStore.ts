import { create } from 'zustand';

interface ReferenceState {
  path: string | null;
  imageData: Uint8ClampedArray | null;
  width: number;
  height: number;
  opacity: number;          // 0.0–1.0
  position: { x: number; y: number }; // canvas-space top-left
  visible: boolean;

  setImage(path: string, pixels: Uint8ClampedArray, w: number, h: number): void;
  setOpacity(v: number): void;
  setPosition(pos: { x: number; y: number }): void;
  setVisible(v: boolean): void;
  clear(): void;
}

export const useReferenceStore = create<ReferenceState>()((set) => ({
  path: null,
  imageData: null,
  width: 0,
  height: 0,
  opacity: 0.5,
  position: { x: 0, y: 0 },
  visible: true,

  setImage(path, pixels, w, h) {
    set({ path, imageData: pixels, width: w, height: h });
  },

  setOpacity(v) {
    set({ opacity: v });
  },

  setPosition(pos) {
    set({ position: pos });
  },

  setVisible(v) {
    set({ visible: v });
  },

  clear() {
    set({ path: null, imageData: null, width: 0, height: 0, position: { x: 0, y: 0 }, visible: true });
  },
}));
