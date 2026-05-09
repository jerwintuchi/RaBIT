import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CanvasConfig } from '../core/DataModel';
import { makeCanvasConfig } from '../core/DataModel';

interface ProjectMeta {
  name: string;
  filePath: string | null;
  dirty: boolean; // unsaved changes
  savedAt: number | null; // unix ms
  projectId: string | null;
  application: string;
  author: string | null;
  createdAt: number | null;
  modifiedAt: number | null;
}

interface ProjectState {
  meta: ProjectMeta;
  canvas: CanvasConfig;

  setName(name: string, markDirty?: boolean): void;
  setFilePath(path: string | null): void;
  setDirty(dirty: boolean): void;
  markSaved(): void;
  setProjectId(id: string): void;
  setCanvasConfig(config: Partial<CanvasConfig>): void;
  resetProject(
    meta: Partial<ProjectMeta>,
    canvas?: Partial<CanvasConfig>,
  ): void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    meta: {
      name: 'Untitled',
      filePath: null,
      dirty: false,
      savedAt: null,
      projectId: null,
      application: 'RaBIT 0.1.0',
      author: null,
      createdAt: null,
      modifiedAt: null,
    },
    canvas: makeCanvasConfig(32, 32),

    setName(name, markDirty = true) {
      set((s) => {
        s.meta.name = name;
        if (markDirty) s.meta.dirty = true;
      });
    },

    setFilePath(path) {
      set((s) => {
        s.meta.filePath = path;
      });
    },

    setDirty(dirty) {
      set((s) => {
        s.meta.dirty = dirty;
      });
    },

    markSaved() {
      set((s) => {
        s.meta.dirty = false;
        s.meta.savedAt = Date.now();
      });
    },

    setProjectId(id) {
      set((s) => {
        s.meta.projectId = id;
      });
    },

    setCanvasConfig(config) {
      set((s) => {
        Object.assign(s.canvas, config);
        s.meta.dirty = true;
      });
    },

    resetProject(meta, canvas) {
      set((s) => {
        Object.assign(s.meta, meta);
        if (canvas) Object.assign(s.canvas, canvas);
      });
    },
  })),
);
