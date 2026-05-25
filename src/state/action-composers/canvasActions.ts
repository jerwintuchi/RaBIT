import {
  ResizeCanvasCommand,
  type ResizeMode,
  type ResizeCanvasCommandDeps,
} from '../../core/commands/ResizeCanvasCommand';
import { TransformCommand, type TransformCommandDeps } from '../../core/commands/TransformCommand';
import { useProjectStore } from '../useProjectStore';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { useHistoryStore } from '../useHistoryStore';
import { useUIStore } from '../useUIStore';
import { getEngine, DirtyFlag, uploadLayerData } from '../renderBridge';
import { resolveCell } from './frame-utils';
import type { Cell } from '../../core/DataModel';

function getDeps(): ResizeCanvasCommandDeps {
  return {
    getFrameIds: () => useFrameStore.getState().frames.map((f) => f.id),
    getLayerIds: () => useLayerStore.getState().layers.map((l) => l.id),
    getRawCell: (frameId, layerId) => {
      const frame = useFrameStore.getState().frames.find((f) => f.id === frameId);
      return frame?.cells[layerId];
    },
    setCell: (frameId, layerId, cell) =>
      useFrameStore.getState().setCell(frameId, layerId, cell),
    removeCell: (frameId, layerId) =>
      useFrameStore.setState((s) => {
        const frame = s.frames.find((f) => f.id === frameId);
        if (frame) delete frame.cells[layerId];
      }),
    setCanvasSize: (width, height) => {
      useProjectStore.getState().setCanvasConfig({ width, height });
      getEngine()?.setCanvasSize(width, height);
      getEngine()?.markDirty(DirtyFlag.FULL);
    },
    invalidateAllTextures: () => {
      getEngine()?.markDirty(DirtyFlag.FULL);
    },
  };
}

export function resizeCanvas(newW: number, newH: number, mode: ResizeMode): void {
  const { width: oldW, height: oldH } = useProjectStore.getState().canvas;
  if (newW === oldW && newH === oldH) return;

  const cmd = new ResizeCanvasCommand(oldW, oldH, newW, newH, mode, getDeps());
  useHistoryStore.getState().execute(cmd);
}

// ── Module-level deferred for rotate confirm dialog ─────────────────────────

let pendingRotateResolver: ((confirmed: boolean) => void) | null = null;

/** Called by RotateConfirmDialog buttons to resolve the pending confirmation. */
export function resolveRotateConfirm(confirmed: boolean): void {
  if (pendingRotateResolver) {
    pendingRotateResolver(confirmed);
    pendingRotateResolver = null;
  }
}

function buildTransformDeps(): TransformCommandDeps {
  return {
    notifyLayerChanged: (layerId, data) => {
      uploadLayerData(layerId, data);
      getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
      useLayerStore.getState().bumpDataVersion(layerId);
    },
    resizeCanvas: (width, height) => {
      useProjectStore.getState().setCanvasConfig({ width, height });
      getEngine()?.setCanvasSize(width, height);
      getEngine()?.markDirty(DirtyFlag.FULL);
    },
    setCell: (layerId, frameIndex, data) => {
      const frames = useFrameStore.getState().frames;
      const frame = frames[frameIndex];
      if (!frame) return;
      const cell: Cell = { linked: false, data };
      useFrameStore.getState().setCell(frame.id, layerId, cell);
    },
  };
}

export function flipLayer(axis: 'h' | 'v'): void {
  const { activeLayerId } = useLayerStore.getState();
  if (!activeLayerId) return;

  const { frames, activeFrameIndex } = useFrameStore.getState();
  const { width, height } = useProjectStore.getState().canvas;

  const raw = resolveCell(frames, activeFrameIndex, activeLayerId);
  if (!raw) return;

  const beforeData = new Uint8ClampedArray(raw);
  const afterData = new Uint8ClampedArray(raw.length);

  if (axis === 'h') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = (y * width + (width - 1 - x)) * 4;
        afterData[dstIdx]     = raw[srcIdx]!;
        afterData[dstIdx + 1] = raw[srcIdx + 1]!;
        afterData[dstIdx + 2] = raw[srcIdx + 2]!;
        afterData[dstIdx + 3] = raw[srcIdx + 3]!;
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * 4;
      const dstRow = y * width * 4;
      for (let x = 0; x < width * 4; x++) {
        afterData[dstRow + x] = raw[srcRow + x]!;
      }
    }
  }

  const cmd = new TransformCommand(
    { layerId: activeLayerId, frameIndex: activeFrameIndex, beforeData, afterData },
    buildTransformDeps(),
  );
  useHistoryStore.getState().execute(cmd);
}

export async function rotateLayer(dir: 'cw' | 'ccw'): Promise<void> {
  const { activeLayerId } = useLayerStore.getState();
  if (!activeLayerId) return;

  const { frames, activeFrameIndex } = useFrameStore.getState();
  const { width, height } = useProjectStore.getState().canvas;

  const raw = resolveCell(frames, activeFrameIndex, activeLayerId);
  if (!raw) return;

  if (width !== height) {
    const confirmed = await new Promise<boolean>((resolve) => {
      pendingRotateResolver = resolve;
      useUIStore.getState().showRotateConfirmDialog(dir);
    });
    if (!confirmed) return;
  }

  const beforeData = new Uint8ClampedArray(raw);
  const newW = height;
  const newH = width;
  const afterData = new Uint8ClampedArray(newW * newH * 4);

  if (dir === 'cw') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = (x * newW + (height - 1 - y)) * 4;
        afterData[dstIdx]     = raw[srcIdx]!;
        afterData[dstIdx + 1] = raw[srcIdx + 1]!;
        afterData[dstIdx + 2] = raw[srcIdx + 2]!;
        afterData[dstIdx + 3] = raw[srcIdx + 3]!;
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = ((width - 1 - x) * newW + y) * 4;
        afterData[dstIdx]     = raw[srcIdx]!;
        afterData[dstIdx + 1] = raw[srcIdx + 1]!;
        afterData[dstIdx + 2] = raw[srcIdx + 2]!;
        afterData[dstIdx + 3] = raw[srcIdx + 3]!;
      }
    }
  }

  const dimsChanged = width !== height;
  const cmd = new TransformCommand(
    {
      layerId: activeLayerId,
      frameIndex: activeFrameIndex,
      beforeData,
      afterData,
      ...(dimsChanged ? { beforeCanvas: { width, height }, afterCanvas: { width: newW, height: newH } } : {}),
    },
    buildTransformDeps(),
  );
  useHistoryStore.getState().execute(cmd);
}
