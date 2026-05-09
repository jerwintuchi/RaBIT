import { invoke } from '@tauri-apps/api/core';

export interface UiPrefs {
  scale: number;
}

export interface EditorPrefs {
  autosave_interval_minutes: number;
  max_undo_stack: number;
  default_frame_duration_ms: number;
}

export interface KeybindingPrefs {
  overrides: Record<string, string>;
}

export interface RecentPrefs {
  files: string[];
}

export interface Preferences {
  schema_version: number;
  ui: UiPrefs;
  editor: EditorPrefs;
  keybindings: KeybindingPrefs;
  recent: RecentPrefs;
}

export interface PrefsLoadResult {
  prefs: Preferences;
  was_corrupt: boolean;
}

export function ipcPrefsLoad(): Promise<PrefsLoadResult> {
  return invoke<PrefsLoadResult>('prefs_load');
}

export function ipcPrefsSave(prefs: Preferences): Promise<void> {
  return invoke<void>('prefs_save', { prefs });
}

export function ipcPrefsReset(): Promise<Preferences> {
  return invoke<Preferences>('prefs_reset');
}
