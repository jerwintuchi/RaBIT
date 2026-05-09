import { getCurrentWindow } from '@tauri-apps/api/window';
import { dtoToProject, projectToDto } from '../../bridge/projectSerializer';
import {
  ipcAutoSaveCheckRecovery,
  ipcAutoSaveDiscard,
  ipcAutoSaveMarkClean,
  ipcAutoSaveRestore,
  ipcAutoSaveWrite,
  ipcClearFileWatch,
  ipcGetRecentFiles,
  ipcOpenProject,
  ipcOpenProjectAt,
  ipcRemoveRecentFile,
  ipcSaveProject,
  ipcSaveProjectAs,
} from '../../bridge/projectIpc';
import type { Project } from '../../core/DataModel/types';
import { useFrameStore } from '../useFrameStore';
import { useHistoryStore } from '../useHistoryStore';
import { useLayerStore } from '../useLayerStore';
import { usePaletteStore } from '../usePaletteStore';
import { useProjectStore } from '../useProjectStore';
import { toast, useUIStore } from '../useUIStore';
import { initNewProject } from './project-init';

// ── Module-level deferred for unsaved-changes dialog ─────────────────────────

let pendingDiscardResolver: ((confirmed: boolean) => void) | null = null;

/** Called by UnsavedChangesDialog buttons to resolve the pending confirmation. */
export function resolvePendingDiscard(confirmed: boolean): void {
  if (pendingDiscardResolver) {
    pendingDiscardResolver(confirmed);
    pendingDiscardResolver = null;
  }
}

// ── Internal utilities ────────────────────────────────────────────────────────

function snapshotProject(): Project {
  const { meta, canvas } = useProjectStore.getState();
  const { layers, activeLayerId } = useLayerStore.getState();
  const { frames, activeFrameIndex, tags } = useFrameStore.getState();
  const { palette } = usePaletteStore.getState();
  const { zoomLevel, panOffset } = useUIStore.getState();

  return {
    schemaVersion: 1,
    projectId: meta.projectId ?? '',
    name: meta.name,
    author: meta.author,
    createdAt: meta.createdAt ?? Date.now(),
    modifiedAt: Date.now(),
    application: meta.application,
    canvas,
    layers,
    frames,
    palette,
    tags,
    activeLayerId,
    activeFrameIndex,
    zoomLevel,
    panOffset,
  };
}

function nameFromPath(path: string): string {
  const base = path.replace(/\\/g, '/').split('/').pop() ?? path;
  return base.replace(/\.rabit$/i, '') || base;
}

function hydrateFromDto(dto: import('../../bridge/projectIpc').ProjectDto, path: string): void {
  const project = dtoToProject(dto);

  useProjectStore.getState().resetProject(
    {
      name: nameFromPath(path),
      filePath: path,
      dirty: false,
      savedAt: Date.now(),
      projectId: project.projectId,
      application: project.application,
      author: project.author,
      createdAt: project.createdAt,
      modifiedAt: project.modifiedAt,
    },
    project.canvas,
  );

  useLayerStore.getState().setLayers(project.layers);
  useLayerStore.getState().setActiveLayer(project.activeLayerId);
  useFrameStore.getState().setFrames(project.frames);
  useFrameStore.getState().setActiveFrameIndex(project.activeFrameIndex);
  usePaletteStore.getState().setPalette(project.palette);
  useHistoryStore.getState().clear();
  useUIStore.getState().setZoomLevel(project.zoomLevel);
  useUIStore.getState().setPanOffset(project.panOffset);
}

async function refreshRecentFiles(): Promise<void> {
  try {
    const files = await ipcGetRecentFiles();
    useUIStore.getState().setRecentFiles(files);
  } catch {
    // Non-fatal — recent files list is cosmetic
  }
}

async function syncWindowTitle(): Promise<void> {
  const { meta } = useProjectStore.getState();
  const prefix = meta.dirty ? '* ' : '';
  const name = meta.name;
  const location = meta.filePath
    ? formatShortPath(meta.filePath)
    : 'Unsaved';
  try {
    await getCurrentWindow().setTitle(`${prefix}${name} — ${location} — RaBIT`);
  } catch {
    // Non-fatal in dev (no native window)
  }
}

function formatShortPath(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, '/').split('/');
  return parts.length > 2
    ? `…/${parts.slice(-2).join('/')}`
    : fullPath;
}

async function confirmDiscardIfDirty(intent: import('../useUIStore').UnsavedIntent): Promise<boolean> {
  const { meta } = useProjectStore.getState();
  if (!meta.dirty) return true;

  return new Promise((resolve) => {
    pendingDiscardResolver = resolve;
    useUIStore.getState().showUnsavedChangesDialog(intent);
  });
}

// ── Save operations ───────────────────────────────────────────────────────────

export async function saveProject(): Promise<boolean> {
  const { meta } = useProjectStore.getState();

  if (!meta.filePath) {
    return saveProjectAs();
  }

  const payload = { project: projectToDto(snapshotProject()) };

  try {
    const result = await ipcSaveProject(meta.filePath, payload);
    (window as unknown as Record<string, unknown>)['__rabitSavedAt'] = Date.now();
    useProjectStore.getState().markSaved();
    useProjectStore.getState().setFilePath(result.path);
    await ipcAutoSaveMarkClean().catch(() => null);
    await syncWindowTitle();
    await refreshRecentFiles();
    return true;
  } catch (e) {
    toast.error(`Save failed: ${String(e)}`);
    return false;
  }
}

export async function saveProjectAs(): Promise<boolean> {
  const payload = { project: projectToDto(snapshotProject()) };

  try {
    const result = await ipcSaveProjectAs(payload);
    if (!result) return false; // user cancelled

    (window as unknown as Record<string, unknown>)['__rabitSavedAt'] = Date.now();
    useProjectStore.getState().markSaved();
    useProjectStore.getState().setFilePath(result.path);
    useProjectStore.getState().setName(nameFromPath(result.path), false);
    await ipcAutoSaveMarkClean().catch(() => null);
    await syncWindowTitle();
    await refreshRecentFiles();
    return true;
  } catch (e) {
    toast.error(`Save failed: ${String(e)}`);
    return false;
  }
}

// ── Open operations ───────────────────────────────────────────────────────────

export async function openProject(): Promise<boolean> {
  if (!await confirmDiscardIfDirty('open')) return false;

  try {
    const result = await ipcOpenProject();
    if (!result) return false; // user cancelled

    hydrateFromDto(result.project, result.path);
    await syncWindowTitle();
    await refreshRecentFiles();
    return true;
  } catch (e) {
    toast.error(`Failed to open file: ${String(e)}`);
    return false;
  }
}

export async function openProjectAt(path: string): Promise<boolean> {
  if (!await confirmDiscardIfDirty('open')) return false;

  try {
    const result = await ipcOpenProjectAt(path);
    hydrateFromDto(result.project, result.path);
    useUIStore.getState().setWelcomeVisible(false);
    await syncWindowTitle();
    await refreshRecentFiles();
    return true;
  } catch (e) {
    // File not found or corrupt — remove from recent list
    await ipcRemoveRecentFile(path).catch(() => null);
    await refreshRecentFiles();
    toast.error(`File not found or could not be opened. It has been removed from recent files.`);
    return false;
  }
}

export async function reloadFromDisk(path: string): Promise<void> {
  try {
    const result = await ipcOpenProjectAt(path);
    hydrateFromDto(result.project, result.path);
    useUIStore.getState().hideExternalChangeDialog();
    await syncWindowTitle();
  } catch (e) {
    toast.error(`Reload failed: ${String(e)}`);
    useUIStore.getState().hideExternalChangeDialog();
  }
}

export async function removeRecentFile(path: string): Promise<void> {
  await ipcRemoveRecentFile(path).catch(() => null);
  await refreshRecentFiles();
}

export async function clearRecentFiles(): Promise<void> {
  const files = useUIStore.getState().recentFiles;
  for (const f of files) {
    await ipcRemoveRecentFile(f.path).catch(() => null);
  }
  await refreshRecentFiles();
}

// ── New project ───────────────────────────────────────────────────────────────

export async function newProject(
  name: string,
  width: number,
  height: number,
): Promise<void> {
  if (!await confirmDiscardIfDirty('new')) return;
  initNewProject(name, width, height);
  useProjectStore.getState().setFilePath(null);
  useProjectStore.getState().setDirty(false);
  useUIStore.getState().setWelcomeVisible(false);
  useUIStore.getState().hideNewProjectDialog();
  await ipcClearFileWatch().catch(() => null);
  await syncWindowTitle();
}

export function newProjectWithDialog(): void {
  useUIStore.getState().showNewProjectDialog();
}

// ── Close guard ───────────────────────────────────────────────────────────────

export async function handleCloseRequest(): Promise<void> {
  const canClose = await confirmDiscardIfDirty('close');
  if (canClose) {
    await ipcAutoSaveMarkClean().catch(() => null);
    await getCurrentWindow().destroy();
  }
}

// ── Dirty tracking subscriptions (call once on app mount) ────────────────────

let subscriptionsStarted = false;

export function startDirtySubscriptions(): void {
  if (subscriptionsStarted) return;
  subscriptionsStarted = true;

  // Subscribe to any store change — marks project dirty on content mutations
  useLayerStore.subscribe(() => useProjectStore.getState().setDirty(true));
  useFrameStore.subscribe(() => useProjectStore.getState().setDirty(true));
  usePaletteStore.subscribe(() => useProjectStore.getState().setDirty(true));

  // Keep window title in sync with dirty flag
  useProjectStore.subscribe(() => { syncWindowTitle().catch(() => null); });
}

// ── Re-export syncWindowTitle for use in App.tsx ──────────────────────────────
export { syncWindowTitle };

// ── M10: Auto-save actions ────────────────────────────────────────────────────

/** Write a crash-recovery snapshot. Called by App.tsx on each autosave:request tick. */
export async function writeAutoSave(): Promise<void> {
  const payload = { project: projectToDto(snapshotProject()) };
  await ipcAutoSaveWrite(payload).catch((e) => {
    toast.warning(`Auto-save failed: ${String(e)}`);
  });
}

/** Mark the manifest as clean. Called after every successful manual save and clean exit. */
export async function markAutoSaveClean(): Promise<void> {
  await ipcAutoSaveMarkClean().catch(() => null);
}

/** Restore the crash-recovery file as an untitled project. */
export async function restoreRecovery(): Promise<void> {
  try {
    const result = await ipcAutoSaveRestore();
    hydrateFromDto(result.project, result.path);
    // Override name — recovered project is untitled until user saves
    useProjectStore.getState().setName('Recovered (Untitled)', false);
    useProjectStore.getState().setFilePath(null);
    useProjectStore.getState().setDirty(true);
    useUIStore.getState().setWelcomeVisible(false);
    useUIStore.getState().hideCrashRecoveryDialog();
    await ipcAutoSaveDiscard().catch(() => null);
    await syncWindowTitle();
  } catch (e) {
    toast.error(`Recovery failed: ${String(e)}`);
    useUIStore.getState().hideCrashRecoveryDialog();
  }
}

/** Discard the crash-recovery file and proceed normally. */
export async function discardRecovery(): Promise<void> {
  await ipcAutoSaveDiscard().catch(() => null);
  useUIStore.getState().hideCrashRecoveryDialog();
}

/** Check for a stale recovery on app startup. Shows the dialog if one is found. */
export async function checkCrashRecovery(): Promise<void> {
  try {
    const info = await ipcAutoSaveCheckRecovery();
    if (info) {
      useUIStore.getState().showCrashRecoveryDialog(info.saved_at, info.project_name);
    }
  } catch {
    // Non-fatal — treat as no recovery
  }
}
