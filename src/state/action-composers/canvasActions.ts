import {
  ResizeCanvasCommand,
  type ResizeMode,
  type ResizeCanvasCommandDeps,
} from '../../core/commands/ResizeCanvasCommand';
import { useProjectStore } from '../useProjectStore';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { useHistoryStore } from '../useHistoryStore';
import { getEngine, DirtyFlag } from '../renderBridge';

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
