import {
  ipcExportPng,
  ipcExportSpritesheet,
  listenExportProgress,
  type PngExportOptions,
  type SpritesheetExportOptions,
  type ExportProgress,
} from '../../bridge/exportIpc';
import { projectToDto } from '../../bridge/projectSerializer';
import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';
import { usePaletteStore } from '../usePaletteStore';
import { useProjectStore } from '../useProjectStore';
import { toast, useUIStore } from '../useUIStore';

function snapshotForExport() {
  const { meta, canvas } = useProjectStore.getState();
  const { layers, activeLayerId } = useLayerStore.getState();
  const { frames, activeFrameIndex, tags } = useFrameStore.getState();
  const { palette } = usePaletteStore.getState();

  return projectToDto({
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
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
  });
}

export async function exportPng(
  opts: Omit<PngExportOptions, 'project'>,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  const project = snapshotForExport();
  let unlisten: (() => void) | null = null;

  if (onProgress) {
    unlisten = await listenExportProgress(onProgress).catch(() => null);
  }

  try {
    const result = await ipcExportPng({ ...opts, project });
    useUIStore.getState().hideExportDialog();
    const count = result.paths.length;
    const dir = result.paths[0]
      ? result.paths[0].replace(/[\\/][^\\/]+$/, '')
      : '';
    toast.info(`Exported ${count} frame${count !== 1 ? 's' : ''} to ${dir}`);
  } catch (e) {
    toast.error(`Export failed: ${String(e)}`);
  } finally {
    unlisten?.();
  }
}

export async function exportSpritesheet(
  opts: Omit<SpritesheetExportOptions, 'project'>,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  const project = snapshotForExport();
  let unlisten: (() => void) | null = null;

  if (onProgress) {
    unlisten = await listenExportProgress(onProgress).catch(() => null);
  }

  try {
    const result = await ipcExportSpritesheet({ ...opts, project });
    useUIStore.getState().hideExportDialog();
    const pngPath = result.paths[0] ?? '';
    toast.info(`Spritesheet exported to ${pngPath}`);
  } catch (e) {
    toast.error(`Export failed: ${String(e)}`);
  } finally {
    unlisten?.();
  }
}
