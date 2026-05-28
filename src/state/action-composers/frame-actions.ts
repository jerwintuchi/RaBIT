import { nanoid } from 'nanoid';
import type { Cell, FrameId, LayerId } from '../../core/DataModel';
import { makeCell, makeFrame } from '../../core/DataModel';
import {
  AddFrameCommand,
  RemoveFrameCommand,
  DuplicateFrameCommand,
  ReorderFrameCommand,
  ReorderMultipleFramesCommand,
  BatchInsertFramesCommand,
  SetFrameDurationCommand,
  ClearCellCommand,
  SetFrameLayerVisibilityCommand,
  SetFrameLayerVisibilityBatchCommand,
  type FrameCommandDeps,
} from '../../core/commands/FrameCommands';
import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';
import { useProjectStore } from '../useProjectStore';
import { useHistoryStore } from '../useHistoryStore';
import { getEngine, DirtyFlag } from '../renderBridge';
import { cloneCell, resolveCell } from './frame-utils';
import { shiftTagsForInsert, shiftTagsForDelete } from './tagActions';

function cloneFrameCells(src: { cells: Record<LayerId, Cell> }): Record<LayerId, Cell> {
  const cells: Record<LayerId, Cell> = {};
  for (const [id, cell] of Object.entries(src.cells))
    cells[id] = cloneCell(cell);
  return cells;
}

let _deps: FrameCommandDeps | null = null;

function getDeps(): FrameCommandDeps {
  if (_deps) return _deps;
  _deps = {
    insertFrame(frame, index) {
      useFrameStore.setState((s) => {
        const frames = [...s.frames];
        frames.splice(index, 0, frame);
        return { frames };
      });
      shiftTagsForInsert(index);
    },
    removeFrame(id) {
      const { frames } = useFrameStore.getState();
      const at = frames.findIndex((f) => f.id === id);
      useFrameStore.getState().removeFrame(id);
      if (at >= 0) shiftTagsForDelete(at);
    },
    setFrames(frames) {
      useFrameStore.getState().setFrames(frames);
    },
    setActiveFrameIndex(index) {
      useFrameStore.getState().setActiveFrameIndex(index);
    },
    reorderFrames(from, to) {
      useFrameStore.getState().reorderFrames(from, to);
    },
    setFrameDuration(id, duration) {
      useFrameStore.getState().setFrameDuration(id, duration);
    },
    setCell(frameId, layerId, cell) {
      useFrameStore.getState().setCell(frameId, layerId, cell);
    },
    clearCell(frameId, layerId, canvasW, canvasH) {
      useFrameStore.getState().setCell(frameId, layerId, makeCell(canvasW, canvasH));
    },
    notifyFrameChanged() {
      const engine = getEngine();
      if (!engine) return;
      const { frames, activeFrameIndex } = useFrameStore.getState();
      const { layers } = useLayerStore.getState();
      for (const layer of layers) {
        const data = resolveCell(frames, activeFrameIndex, layer.id);
        if (data) engine.uploadLayerData(layer.id, data);
      }
      engine.markDirty(DirtyFlag.LAYER_DATA | DirtyFlag.FULL);
    },
    setFrameLayerHidden(frameId, layerId, hidden) {
      useFrameStore.getState().setFrameLayerHidden(frameId, layerId, hidden);
    },
    setAllFramesLayerHidden(layerId, hidden) {
      useFrameStore.getState().setAllFramesLayerHidden(layerId, hidden);
    },
  };
  return _deps;
}

/** Add a new blank frame after the current active frame. */
export function addFrame(): void {
  const { activeFrameIndex } = useFrameStore.getState();
  const { layers } = useLayerStore.getState();
  const { canvas } = useProjectStore.getState();
  const layerIds = layers.map((l) => l.id);
  const newFrame = makeFrame(layerIds, canvas.width, canvas.height);
  const insertAt = activeFrameIndex + 1;
  const cmd = new AddFrameCommand(newFrame, insertAt, activeFrameIndex, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Add a new blank frame appended at the very end of the frame list. */
export function addFrameAtEnd(): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const { layers } = useLayerStore.getState();
  const { canvas } = useProjectStore.getState();
  const layerIds = layers.map((l) => l.id);
  const newFrame = makeFrame(layerIds, canvas.width, canvas.height);
  const cmd = new AddFrameCommand(newFrame, frames.length, activeFrameIndex, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Delete the active frame (no-op if only one frame). */
export function removeActiveFrame(): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  if (frames.length <= 1) return;
  const frame = frames[activeFrameIndex];
  if (!frame) return;
  const nextIndex = Math.min(activeFrameIndex, frames.length - 2);
  const cmd = new RemoveFrameCommand(
    frame,
    activeFrameIndex,
    activeFrameIndex,
    nextIndex,
    getDeps(),
  );
  useHistoryStore.getState().execute(cmd);
}

/** Duplicate the active frame, inserting the copy directly after. */
export function duplicateActiveFrame(): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const src = frames[activeFrameIndex];
  if (!src) return;

  const dup = { ...src, id: nanoid(12), cells: cloneFrameCells(src) };
  const insertAt = activeFrameIndex + 1;
  const cmd = new DuplicateFrameCommand(dup, insertAt, activeFrameIndex, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Duplicate a specific frame by index, inserting the copy immediately after. */
export function duplicateFrameAtIndex(frameIndex: number): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const src = frames[frameIndex];
  if (!src) return;
  const dup = { ...src, id: nanoid(12), cells: cloneFrameCells(src) };
  const insertAt = frameIndex + 1;
  const cmd = new DuplicateFrameCommand(dup, insertAt, activeFrameIndex, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/**
 * Move multiple frames (given by their current indices) to a new position,
 * inserting them as a group before `insertBefore` in the post-removal array.
 * Fully undoable via ReorderMultipleFramesCommand.
 */
export function reorderMultipleFrames(fromIndices: number[], insertBefore: number): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const beforeFrames = [...frames];

  const toMoveSet = new Set(fromIndices);
  const sorted = [...fromIndices].sort((a, b) => a - b);
  const moved = sorted.map((i) => frames[i]).filter(Boolean) as typeof frames;
  const rest = frames.filter((_, i) => !toMoveSet.has(i));

  const removedBefore = sorted.filter((i) => i < insertBefore).length;
  const slot = Math.max(0, Math.min(rest.length, insertBefore - removedBefore));

  const afterFrames = [...rest.slice(0, slot), ...moved, ...rest.slice(slot)];

  const activeFrame = frames[activeFrameIndex];
  const afterActiveIdx = activeFrame
    ? Math.max(0, afterFrames.findIndex((f) => f.id === activeFrame.id))
    : 0;

  const cmd = new ReorderMultipleFramesCommand(
    beforeFrames, afterFrames,
    activeFrameIndex, afterActiveIdx,
    getDeps(),
  );
  useHistoryStore.getState().execute(cmd);
}

/**
 * Duplicate the frames at the given indices (sorted), inserting all copies
 * collectively right after the rightmost source frame. Fully undoable.
 */
export function duplicateFramesAfterLast(sourceIndices: number[]): void {
  if (sourceIndices.length === 0) return;
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const sorted = [...sourceIndices].sort((a, b) => a - b);

  const copies = sorted.map((fi) => {
    const src = frames[fi]!;
    return { ...src, id: nanoid(12), cells: cloneFrameCells(src) };
  });

  // Insert all copies starting right after the rightmost source frame
  const insertAt = sorted[sorted.length - 1]! + 1;
  const cmd = new BatchInsertFramesCommand(copies, insertAt, activeFrameIndex, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Reorder a frame from one index to another. */
export function reorderFrame(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  const cmd = new ReorderFrameCommand(fromIndex, toIndex, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Set a frame's duration in milliseconds. */
export function setFrameDuration(frameId: FrameId, before: number, after: number): void {
  if (before === after) return;
  const cmd = new SetFrameDurationCommand(frameId, before, after, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Delete the frame at a specific index (no-op if only one frame). */
export function removeFrameAtIndex(frameIndex: number): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  if (frames.length <= 1) return;
  const frame = frames[frameIndex];
  if (!frame) return;
  const newActive =
    frameIndex < activeFrameIndex
      ? activeFrameIndex - 1
      : Math.min(activeFrameIndex, frames.length - 2);
  const cmd = new RemoveFrameCommand(frame, frameIndex, activeFrameIndex, newActive, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Toggle a layer's visibility on a specific frame only. */
export function setFrameLayerHidden(frameId: FrameId, layerId: LayerId, hidden: boolean): void {
  const cmd = new SetFrameLayerVisibilityCommand(frameId, layerId, hidden, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Toggle a layer's visibility on every frame at once (single undo step). */
export function setFrameLayerHiddenAll(layerId: LayerId, hidden: boolean): void {
  const cmd = new SetFrameLayerVisibilityBatchCommand(layerId, hidden, getDeps());
  useHistoryStore.getState().execute(cmd);
}

/** Clear the active layer's cell in the active frame to transparent pixels. */
export function clearActiveCell(): void {
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const { activeLayerId } = useLayerStore.getState();
  const { canvas } = useProjectStore.getState();
  if (!activeLayerId) return;
  const frame = frames[activeFrameIndex];
  if (!frame) return;
  const before = frame.cells[activeLayerId];
  if (!before) return;
  const cmd = new ClearCellCommand(
    frame.id,
    activeLayerId,
    before,
    canvas.width,
    canvas.height,
    getDeps(),
  );
  useHistoryStore.getState().execute(cmd);
}
