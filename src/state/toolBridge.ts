// Bridges the ToolEngine into the state layer. Owns the engine singleton and
// builds a ToolEngineContext that reads from / writes to Zustand stores.
import { ToolEngine } from '../core/ToolEngine';
import type { ToolEngineContext, ToolId, RawPointerInput } from '../core/ToolEngine';
import { PencilTool } from '../core/tools';
import type { Command } from '../core/CommandSystem';
import { useFrameStore } from './useFrameStore';
import { useLayerStore } from './useLayerStore';
import { useProjectStore } from './useProjectStore';
import { usePaletteStore } from './usePaletteStore';
import { useHistoryStore } from './useHistoryStore';
import { resolveCell } from './action-composers/frame-utils';
import {
  updateScratch as bridgeUpdateScratch,
  clearScratch as bridgeClearScratch,
  uploadLayerData,
  DirtyFlag,
  getEngine,
} from './renderBridge';

let _toolEngine: ToolEngine | null = null;

function buildContext(): ToolEngineContext {
  return {
    getActiveLayerId: () => useLayerStore.getState().activeLayerId,
    getLayerData: (layerId) => {
      const { frames, activeFrameIndex } = useFrameStore.getState();
      return resolveCell(frames, activeFrameIndex, layerId);
    },
    getCanvasSize: () => {
      const { width, height } = useProjectStore.getState().canvas;
      return { width, height };
    },
    getPrimaryColor: () => usePaletteStore.getState().primaryColor,
    updateScratch: (data) => bridgeUpdateScratch(data),
    clearScratch: () => bridgeClearScratch(),
    executeCommand: (cmd: Command) => useHistoryStore.getState().execute(cmd),
    notifyLayerChanged: (layerId, data) => {
      uploadLayerData(layerId, data);
      getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
    },
  };
}

export function initToolEngine(): ToolEngine {
  const ctx = buildContext();
  const engine = new ToolEngine(ctx);
  engine.registerTool(new PencilTool(ctx));
  _toolEngine = engine;
  return engine;
}

export function getToolEngine(): ToolEngine | null {
  return _toolEngine;
}

export function disposeToolEngine(): void {
  _toolEngine = null;
}

// ── Imperative passthrough helpers — let the UI call without holding the engine ──

export function setToolTransform(panX: number, panY: number, zoom: number): void {
  _toolEngine?.setTransform(panX, panY, zoom);
}

export function setActiveTool(id: ToolId): void {
  _toolEngine?.setActiveTool(id);
}

export function toolPointerDown(input: RawPointerInput): void {
  _toolEngine?.pointerDown(input);
}

export function toolPointerMove(input: RawPointerInput): void {
  _toolEngine?.pointerMove(input);
}

export function toolPointerUp(input: RawPointerInput): void {
  _toolEngine?.pointerUp(input);
}

export function toolCancel(): void {
  _toolEngine?.cancel();
}
