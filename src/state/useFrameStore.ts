import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Frame, FrameId, Tag, TagId, LayerId, Cell } from '../core/DataModel';
import { makeFrame, makeLinkedCell } from '../core/DataModel';

interface PlaybackState {
  playing: boolean;
  fps: number;
  loop: boolean;
}

interface FrameState {
  frames: Frame[];
  activeFrameIndex: number;
  tags: Tag[];
  playback: PlaybackState;

  setFrames(frames: Frame[]): void;
  setActiveFrameIndex(index: number): void;
  addFrame(
    layerIds: LayerId[],
    canvasWidth: number,
    canvasHeight: number,
    insertAfter?: number,
  ): Frame;
  duplicateFrame(index: number): Frame | undefined;
  removeFrame(id: FrameId): void;
  reorderFrames(fromIndex: number, toIndex: number): void;
  setFrameDuration(id: FrameId, duration: number): void;
  setCell(frameId: FrameId, layerId: LayerId, cell: Cell): void;
  linkCell(frameId: FrameId, layerId: LayerId): void;

  addTag(tag: Tag): void;
  removeTag(id: TagId): void;
  updateTag(id: TagId, patch: Partial<Omit<Tag, 'id'>>): void;

  setPlaying(playing: boolean): void;
  setFps(fps: number): void;
  setLoop(loop: boolean): void;
}

export const useFrameStore = create<FrameState>()(
  immer((set, get) => ({
    frames: [],
    activeFrameIndex: 0,
    tags: [],
    playback: {
      playing: false,
      fps: 12,
      loop: true,
    },

    setFrames(frames) {
      set((s) => {
        s.frames = frames;
      });
    },

    setActiveFrameIndex(index) {
      set((s) => {
        s.activeFrameIndex = Math.max(0, Math.min(s.frames.length - 1, index));
      });
    },

    addFrame(layerIds, canvasWidth, canvasHeight, insertAfter) {
      const frame = makeFrame(layerIds, canvasWidth, canvasHeight);
      set((s) => {
        const idx =
          insertAfter !== undefined
            ? insertAfter + 1
            : s.frames.length;
        s.frames.splice(idx, 0, frame);
      });
      return frame;
    },

    duplicateFrame(index) {
      const src = get().frames[index];
      if (!src) return undefined;

      const cells: Record<LayerId, Cell> = {};
      for (const [layerId, cell] of Object.entries(src.cells)) {
        cells[layerId] = cell.linked
          ? { linked: true, data: null }
          : { linked: false, data: cell.data ? new Uint8ClampedArray(cell.data) : null };
      }
      const dup: Frame = { id: src.id, duration: src.duration, cells };
      const newFrame: Frame = { ...dup, id: nanoid(12) };

      set((s) => {
        s.frames.splice(index + 1, 0, newFrame);
      });
      return newFrame;
    },

    removeFrame(id) {
      set((s) => {
        const idx = s.frames.findIndex((f) => f.id === id);
        if (idx === -1 || s.frames.length === 1) return;
        s.frames.splice(idx, 1);
        if (s.activeFrameIndex >= s.frames.length) {
          s.activeFrameIndex = s.frames.length - 1;
        }
      });
    },

    reorderFrames(fromIndex, toIndex) {
      set((s) => {
        const [removed] = s.frames.splice(fromIndex, 1);
        if (removed) s.frames.splice(toIndex, 0, removed);
      });
    },

    setFrameDuration(id, duration) {
      set((s) => {
        const f = s.frames.find((x) => x.id === id);
        if (f) f.duration = Math.min(10000, Math.max(10, duration));
      });
    },

    setCell(frameId, layerId, cell) {
      set((s) => {
        const f = s.frames.find((x) => x.id === frameId);
        if (f) f.cells[layerId] = cell;
      });
    },

    linkCell(frameId, layerId) {
      set((s) => {
        const f = s.frames.find((x) => x.id === frameId);
        if (f) f.cells[layerId] = makeLinkedCell();
      });
    },

    addTag(tag) {
      set((s) => {
        s.tags.push(tag);
      });
    },

    removeTag(id) {
      set((s) => {
        const idx = s.tags.findIndex((t) => t.id === id);
        if (idx !== -1) s.tags.splice(idx, 1);
      });
    },

    updateTag(id, patch) {
      set((s) => {
        const tag = s.tags.find((t) => t.id === id);
        if (tag) Object.assign(tag, patch);
      });
    },

    setPlaying(playing) {
      set((s) => {
        s.playback.playing = playing;
      });
    },

    setFps(fps) {
      set((s) => {
        s.playback.fps = Math.min(120, Math.max(1, fps));
      });
    },

    setLoop(loop) {
      set((s) => {
        s.playback.loop = loop;
      });
    },
  })),
);
