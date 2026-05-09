import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

// ── Wire-format types (mirror Rust DTOs exactly) ───────────────────────────

export interface PanOffsetDto {
  x: number;
  y: number;
}

export interface CanvasConfigDto {
  width: number;
  height: number;
  colorMode: string;
  backgroundColor: number;
  dpi: number;
}

export interface LayerDto {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
}

/** Cell pixel data arrives as number[] (raw RGBA bytes, JSON-encoded Vec<u8>).
 *  projectSerializer.ts converts to/from Uint8ClampedArray. */
export interface CellDto {
  linked: boolean;
  data: number[] | null;
}

export interface FrameDto {
  id: string;
  duration: number;
  cells: Record<string, CellDto>;
}

export interface SwatchDto {
  color: number;
  name: string | null;
}

export interface PaletteDto {
  id: string;
  name: string;
  swatches: SwatchDto[];
}

export interface TagDto {
  id: string;
  name: string;
  from: number;
  to: number;
  loopDirection: string;
  color: number;
}

export interface ProjectDto {
  schemaVersion: number;
  projectId: string;
  name: string;
  author: string | null;
  createdAt: number;
  modifiedAt: number;
  application: string;
  canvas: CanvasConfigDto;
  layers: LayerDto[];
  frames: FrameDto[];
  palette: PaletteDto;
  tags: TagDto[];
  activeLayerId: string | null;
  activeFrameIndex: number;
  zoomLevel: number;
  panOffset: PanOffsetDto;
}

export interface SaveProjectPayload {
  project: ProjectDto;
}

export interface SaveResult {
  path: string;
  savedAt: number;
}

export interface OpenResult {
  project: ProjectDto;
  path: string;
  loadedAt: number;
}

export interface RecentFileEntry {
  path: string;
  name: string;
  missing: boolean;
}

export interface ExternalChangeEvent {
  path: string;
  changedAt: number;
}

// ── IPC wrappers ──────────────────────────────────────────────────────────

export async function ipcSaveProject(
  path: string,
  payload: SaveProjectPayload,
): Promise<SaveResult> {
  return invoke<SaveResult>('save_project', { path, payload });
}

/** Returns null when the user cancels the Save dialog. */
export async function ipcSaveProjectAs(
  payload: SaveProjectPayload,
): Promise<SaveResult | null> {
  return invoke<SaveResult | null>('save_project_as', { payload });
}

/** Returns null when the user cancels the Open dialog. */
export async function ipcOpenProject(): Promise<OpenResult | null> {
  return invoke<OpenResult | null>('open_project');
}

export async function ipcOpenProjectAt(path: string): Promise<OpenResult> {
  return invoke<OpenResult>('open_project_at', { path });
}

export async function ipcGetRecentFiles(): Promise<RecentFileEntry[]> {
  return invoke<RecentFileEntry[]>('get_recent_files');
}

export async function ipcRemoveRecentFile(path: string): Promise<void> {
  return invoke<void>('remove_recent_file_cmd', { path });
}

export async function ipcClearFileWatch(): Promise<void> {
  return invoke<void>('clear_file_watch');
}

export function listenExternalChange(
  handler: (event: ExternalChangeEvent) => void,
): Promise<UnlistenFn> {
  return listen<ExternalChangeEvent>('file:external_change', (e) =>
    handler(e.payload),
  );
}

// ── M10: Auto-save + crash recovery ──────────────────────────────────────────

export interface AutoSaveResult {
  saved_at: number;
}

export interface RecoveryInfo {
  saved_at: number;
  project_name: string;
}

export async function ipcAutoSaveWrite(
  payload: SaveProjectPayload,
): Promise<AutoSaveResult> {
  return invoke<AutoSaveResult>('auto_save_write', { payload });
}

export async function ipcAutoSaveCheckRecovery(): Promise<RecoveryInfo | null> {
  return invoke<RecoveryInfo | null>('auto_save_check_recovery');
}

export async function ipcAutoSaveRestore(): Promise<OpenResult> {
  return invoke<OpenResult>('auto_save_restore');
}

export async function ipcAutoSaveDiscard(): Promise<void> {
  return invoke<void>('auto_save_discard');
}

export async function ipcAutoSaveMarkClean(): Promise<void> {
  return invoke<void>('auto_save_mark_clean');
}

/** Fires every 5 minutes from the Rust timer. No payload. */
export function listenAutoSaveRequest(handler: () => void): Promise<UnlistenFn> {
  return listen<null>('autosave:request', () => handler());
}
