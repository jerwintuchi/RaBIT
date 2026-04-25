import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type Theme = 'dark'; // v1 only supports dark

export interface PanelLayout {
  toolbarVisible: boolean;
  layerPanelVisible: boolean;
  timelinePanelVisible: boolean;
  colorPanelVisible: boolean;
  palettePanelVisible: boolean;
}

interface UIState {
  theme: Theme;
  panels: PanelLayout;
  zoomLevel: number; // 1, 2, 4, 8, 16, 32
  panOffset: { x: number; y: number };
  cursorPosition: { x: number; y: number } | null; // canvas pixel coords
  showCheckerboard: boolean;
  showGrid: boolean;
  showPixelGrid: boolean;

  setTheme(theme: Theme): void;
  setPanels(patch: Partial<PanelLayout>): void;
  togglePanel(key: keyof PanelLayout): void;
  setZoomLevel(zoom: number): void;
  setPanOffset(offset: { x: number; y: number }): void;
  setCursorPosition(pos: { x: number; y: number } | null): void;
  setShowCheckerboard(v: boolean): void;
  setShowGrid(v: boolean): void;
  setShowPixelGrid(v: boolean): void;
  resetView(): void;
}

const VALID_ZOOM_LEVELS = [1, 2, 4, 8, 16, 32] as const;

function clampZoom(z: number): number {
  const sorted = [...VALID_ZOOM_LEVELS].sort((a, b) => a - b);
  for (const level of sorted) {
    if (z <= level) return level;
  }
  return sorted[sorted.length - 1] ?? 1;
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    theme: 'dark',
    panels: {
      toolbarVisible: true,
      layerPanelVisible: true,
      timelinePanelVisible: true,
      colorPanelVisible: true,
      palettePanelVisible: true,
    },
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
    cursorPosition: null,
    showCheckerboard: true,
    showGrid: false,
    showPixelGrid: false,

    setTheme(theme) {
      set((s) => {
        s.theme = theme;
      });
    },

    setPanels(patch) {
      set((s) => {
        Object.assign(s.panels, patch);
      });
    },

    togglePanel(key) {
      set((s) => {
        s.panels[key] = !s.panels[key];
      });
    },

    setZoomLevel(zoom) {
      set((s) => {
        s.zoomLevel = clampZoom(zoom);
      });
    },

    setPanOffset(offset) {
      set((s) => {
        s.panOffset = offset;
      });
    },

    setCursorPosition(pos) {
      set((s) => {
        s.cursorPosition = pos;
      });
    },

    setShowCheckerboard(v) {
      set((s) => {
        s.showCheckerboard = v;
      });
    },

    setShowGrid(v) {
      set((s) => {
        s.showGrid = v;
      });
    },

    setShowPixelGrid(v) {
      set((s) => {
        s.showPixelGrid = v;
      });
    },

    resetView() {
      set((s) => {
        s.zoomLevel = 1;
        s.panOffset = { x: 0, y: 0 };
      });
    },
  })),
);
