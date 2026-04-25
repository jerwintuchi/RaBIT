import { makeProject } from '../../core/DataModel';
import { useProjectStore } from '../useProjectStore';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { usePaletteStore } from '../usePaletteStore';
import { useHistoryStore } from '../useHistoryStore';
import { useUIStore } from '../useUIStore';

// Initializes all stores from a new project — used on "New Project".
export function initNewProject(
  name = 'Untitled',
  width = 32,
  height = 32,
): void {
  const project = makeProject(name, width, height);

  useProjectStore.getState().resetProject(
    {
      name: project.name,
      filePath: null,
      dirty: false,
      savedAt: null,
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
