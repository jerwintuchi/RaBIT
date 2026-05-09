import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ProjectDto } from './projectIpc';

// ── Export option types (mirror Rust DTOs exactly) ────────────────────────────

export type FrameSelection =
  | { type: 'current'; index: number }
  | { type: 'all' };

export type SheetLayout =
  | { type: 'horizontal' }
  | { type: 'vertical' }
  | { type: 'grid'; columns: number };

export interface PngExportOptions {
  project: ProjectDto;
  frameSelection: FrameSelection;
  scale: 1 | 2 | 4 | 8 | 16;
  includeBackground: boolean;
  outputDir: string;
  namePrefix: string;
}

export interface SpritesheetExportOptions {
  project: ProjectDto;
  layout: SheetLayout;
  padding: number;
  scale: 1 | 2 | 4 | 8 | 16;
  includeBackground: boolean;
  outputPath: string;
  sidecarJson: boolean;
}

export interface ExportResult {
  paths: string[];
}

export interface ExportProgress {
  done: number;
  total: number;
}

// ── IPC wrappers ──────────────────────────────────────────────────────────────

export async function ipcExportPng(
  options: PngExportOptions,
): Promise<ExportResult> {
  return invoke<ExportResult>('export_png', { options });
}

export async function ipcExportSpritesheet(
  options: SpritesheetExportOptions,
): Promise<ExportResult> {
  return invoke<ExportResult>('export_spritesheet', { options });
}

export function listenExportProgress(
  handler: (progress: ExportProgress) => void,
): Promise<UnlistenFn> {
  return listen<ExportProgress>('export:progress', (e) => handler(e.payload));
}
