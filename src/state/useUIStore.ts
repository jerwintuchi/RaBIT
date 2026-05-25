import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { ZOOM_LEVELS } from './zoomLevels';
import type { RecentFileEntry } from '../bridge/projectIpc';

export type Theme = 'dark'; // v1 only supports dark

export interface PanelLayout {
  toolbarVisible: boolean;
  layerPanelVisible: boolean;
  timelinePanelVisible: boolean;
  colorPanelVisible: boolean;
  palettePanelVisible: boolean;
}

export type UnsavedIntent = 'new' | 'open' | 'close';

export interface Toast {
  id: string;
  message: string;
  variant: 'info' | 'error' | 'warning';
}

interface UIState {
  theme: Theme;
  panels: PanelLayout;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  cursorPosition: { x: number; y: number } | null;
  showCheckerboard: boolean;
  showGrid: boolean;
  showPixelGrid: boolean;
  tileMode: boolean;
  onionSkin: {
    enabled: boolean;
    before: number;
    after: number;
    opacity: number;
  };

  unsavedChangesDialog: {
    open: boolean;
    intent: UnsavedIntent | null;
    pendingPath: string | null;
  };

  externalChangeDialog: {
    open: boolean;
    changedPath: string | null;
  };

  newProjectDialog: {
    open: boolean;
  };

  resizeCanvasDialog: {
    open: boolean;
  };

  crashRecoveryDialog: {
    open: boolean;
    savedAt: number | null;
    projectName: string | null;
  };

  exportDialog: {
    open: boolean;
  };

  prefsDialog: {
    open: boolean;
  };

  rotateConfirmDialog: {
    open: boolean;
    dir: 'cw' | 'ccw';
  };

  welcomeScreen: {
    visible: boolean;
  };

  recentFiles: RecentFileEntry[];
  toasts: Toast[];

  setTheme(theme: Theme): void;
  setPanels(patch: Partial<PanelLayout>): void;
  togglePanel(key: keyof PanelLayout): void;
  setZoomLevel(zoom: number): void;
  setPanOffset(offset: { x: number; y: number }): void;
  setCursorPosition(pos: { x: number; y: number } | null): void;
  setShowCheckerboard(v: boolean): void;
  setShowGrid(v: boolean): void;
  setShowPixelGrid(v: boolean): void;
  setTileMode(on: boolean): void;
  setOnionSkin(patch: Partial<UIState['onionSkin']>): void;
  resetView(): void;

  showUnsavedChangesDialog(intent: UnsavedIntent, pendingPath?: string): void;
  hideUnsavedChangesDialog(): void;

  showExternalChangeDialog(path: string): void;
  hideExternalChangeDialog(): void;

  showNewProjectDialog(): void;
  hideNewProjectDialog(): void;

  showResizeCanvasDialog(): void;
  hideResizeCanvasDialog(): void;

  showCrashRecoveryDialog(savedAt: number, projectName: string): void;
  hideCrashRecoveryDialog(): void;

  showExportDialog(): void;
  hideExportDialog(): void;

  showPrefsDialog(): void;
  hidePrefsDialog(): void;

  showRotateConfirmDialog(dir: 'cw' | 'ccw'): void;
  hideRotateConfirmDialog(): void;

  setWelcomeVisible(v: boolean): void;
  setRecentFiles(files: RecentFileEntry[]): void;

  addToast(message: string, variant?: Toast['variant']): void;
  removeToast(id: string): void;
}

function clampZoom(z: number): number {
  for (const level of ZOOM_LEVELS) {
    if (z <= level) return level;
  }
  return ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 1;
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
    tileMode: false,
    onionSkin: { enabled: false, before: 1, after: 1, opacity: 0.5 },

    unsavedChangesDialog: { open: false, intent: null, pendingPath: null },
    externalChangeDialog: { open: false, changedPath: null },
    newProjectDialog: { open: false },
    resizeCanvasDialog: { open: false },
    crashRecoveryDialog: { open: false, savedAt: null, projectName: null },
    exportDialog: { open: false },
    prefsDialog: { open: false },
    rotateConfirmDialog: { open: false, dir: 'cw' as const },
    welcomeScreen: { visible: false },
    recentFiles: [],
    toasts: [],

    setTheme(theme) {
      set((s) => { s.theme = theme; });
    },

    setPanels(patch) {
      set((s) => { Object.assign(s.panels, patch); });
    },

    togglePanel(key) {
      set((s) => { s.panels[key] = !s.panels[key]; });
    },

    setZoomLevel(zoom) {
      set((s) => { s.zoomLevel = clampZoom(zoom); });
    },

    setPanOffset(offset) {
      set((s) => { s.panOffset = offset; });
    },

    setCursorPosition(pos) {
      set((s) => { s.cursorPosition = pos; });
    },

    setShowCheckerboard(v) {
      set((s) => { s.showCheckerboard = v; });
    },

    setShowGrid(v) {
      set((s) => { s.showGrid = v; });
    },

    setShowPixelGrid(v) {
      set((s) => { s.showPixelGrid = v; });
    },

    setTileMode(on) {
      set((s) => { s.tileMode = on; });
    },

    setOnionSkin(patch) {
      set((s) => { Object.assign(s.onionSkin, patch); });
    },

    resetView() {
      set((s) => {
        s.zoomLevel = 1;
        s.panOffset = { x: 0, y: 0 };
      });
    },

    showUnsavedChangesDialog(intent, pendingPath) {
      set((s) => {
        s.unsavedChangesDialog = { open: true, intent, pendingPath: pendingPath ?? null };
      });
    },

    hideUnsavedChangesDialog() {
      set((s) => {
        s.unsavedChangesDialog = { open: false, intent: null, pendingPath: null };
      });
    },

    showExternalChangeDialog(path) {
      set((s) => {
        s.externalChangeDialog = { open: true, changedPath: path };
      });
    },

    hideExternalChangeDialog() {
      set((s) => {
        s.externalChangeDialog = { open: false, changedPath: null };
      });
    },

    showNewProjectDialog() {
      set((s) => { s.newProjectDialog.open = true; });
    },

    hideNewProjectDialog() {
      set((s) => { s.newProjectDialog.open = false; });
    },

    showResizeCanvasDialog() {
      set((s) => { s.resizeCanvasDialog.open = true; });
    },

    hideResizeCanvasDialog() {
      set((s) => { s.resizeCanvasDialog.open = false; });
    },

    showCrashRecoveryDialog(savedAt, projectName) {
      set((s) => {
        s.crashRecoveryDialog = { open: true, savedAt, projectName };
      });
    },

    hideCrashRecoveryDialog() {
      set((s) => {
        s.crashRecoveryDialog = { open: false, savedAt: null, projectName: null };
      });
    },

    showExportDialog() {
      set((s) => { s.exportDialog.open = true; });
    },

    hideExportDialog() {
      set((s) => { s.exportDialog.open = false; });
    },

    showPrefsDialog() {
      set((s) => { s.prefsDialog.open = true; });
    },

    hidePrefsDialog() {
      set((s) => { s.prefsDialog.open = false; });
    },

    showRotateConfirmDialog(dir) {
      set((s) => { s.rotateConfirmDialog = { open: true, dir }; });
    },

    hideRotateConfirmDialog() {
      set((s) => { s.rotateConfirmDialog.open = false; });
    },

    setWelcomeVisible(v) {
      set((s) => { s.welcomeScreen.visible = v; });
    },

    setRecentFiles(files) {
      set((s) => { s.recentFiles = files; });
    },

    addToast(message, variant = 'info') {
      set((s) => {
        s.toasts.push({ id: nanoid(8), message, variant });
      });
    },

    removeToast(id) {
      set((s) => {
        s.toasts = s.toasts.filter((t) => t.id !== id);
      });
    },
  })),
);

export const toast = {
  info: (msg: string) => useUIStore.getState().addToast(msg, 'info'),
  error: (msg: string) => useUIStore.getState().addToast(msg, 'error'),
  warning: (msg: string) => useUIStore.getState().addToast(msg, 'warning'),
};
