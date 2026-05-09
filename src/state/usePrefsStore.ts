import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Preferences } from '../bridge/prefsIpc';

// ── Default keybindings ───────────────────────────────────────────────────────

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  'tool.pencil':       'b',
  'tool.eraser':       'e',
  'tool.line':         'l',
  'tool.eyedropper':   'i',
  'tool.hand':         'h',
  'tool.zoom':         'z',
  'color.swap':        'x',
  'color.reset':       'd',
  'file.new':          'Ctrl+N',
  'file.open':         'Ctrl+O',
  'file.save':         'Ctrl+S',
  'file.saveAs':       'Ctrl+Shift+S',
  'file.export':       'Ctrl+E',
  'edit.undo':         'Ctrl+Z',
  'edit.redo':         'Ctrl+Y',
  'frame.add':         'Ctrl+Alt+N',
  'frame.duplicate':   'Ctrl+Alt+D',
  'edit.preferences':  'Ctrl+,',
};

export type UiScale = 0.9 | 1.0 | 1.25;

// ── Store interface ───────────────────────────────────────────────────────────

interface PrefsState {
  uiScale: UiScale;
  autosaveIntervalMinutes: number;
  maxUndoStack: number;
  defaultFrameDurationMs: number;
  /** Merged: DEFAULT_KEYBINDINGS + user overrides */
  keybindings: Record<string, string>;
  loaded: boolean;

  hydrate(prefs: Preferences): void;
  setUiScale(scale: UiScale): void;
  setKeybinding(actionId: string, combo: string): void;
  resetKeybinding(actionId: string): void;
  resetAll(): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeKeybindings(overrides: Record<string, string>): Record<string, string> {
  return { ...DEFAULT_KEYBINDINGS, ...overrides };
}

export function applyUiScale(scale: UiScale): void {
  document.documentElement.style.zoom = String(scale);
}

/** Returns the action ID that already uses `combo`, or null if free. */
export function findConflict(
  keybindings: Record<string, string>,
  combo: string,
  excludeActionId: string,
): string | null {
  for (const [id, bound] of Object.entries(keybindings)) {
    if (id !== excludeActionId && bound.toLowerCase() === combo.toLowerCase()) {
      return id;
    }
  }
  return null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePrefsStore = create<PrefsState>()(
  immer((set) => ({
    uiScale: 1.0,
    autosaveIntervalMinutes: 5,
    maxUndoStack: 1000,
    defaultFrameDurationMs: 100,
    keybindings: { ...DEFAULT_KEYBINDINGS },
    loaded: false,

    hydrate(prefs) {
      set((s) => {
        s.uiScale = prefs.ui.scale as UiScale;
        s.autosaveIntervalMinutes = prefs.editor.autosave_interval_minutes;
        s.maxUndoStack = prefs.editor.max_undo_stack;
        s.defaultFrameDurationMs = prefs.editor.default_frame_duration_ms;
        s.keybindings = mergeKeybindings(prefs.keybindings.overrides);
        s.loaded = true;
      });
      applyUiScale(prefs.ui.scale as UiScale);
    },

    setUiScale(scale) {
      set((s) => { s.uiScale = scale; });
      applyUiScale(scale);
    },

    setKeybinding(actionId, combo) {
      set((s) => { s.keybindings[actionId] = combo; });
    },

    resetKeybinding(actionId) {
      set((s) => {
        s.keybindings[actionId] = DEFAULT_KEYBINDINGS[actionId] ?? '';
      });
    },

    resetAll() {
      set((s) => {
        s.uiScale = 1.0;
        s.autosaveIntervalMinutes = 5;
        s.maxUndoStack = 1000;
        s.defaultFrameDurationMs = 100;
        s.keybindings = { ...DEFAULT_KEYBINDINGS };
      });
      applyUiScale(1.0);
    },
  })),
);
