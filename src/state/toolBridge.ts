// Bridges the ToolEngine into the state layer. Owns the engine singleton and
// builds a ToolEngineContext that reads from / writes to Zustand stores.
import { ToolEngine } from '../core/ToolEngine';
import type { ToolEngineContext, ToolId, RawPointerInput } from '../core/ToolEngine';
import {
  PencilTool,
  EraserTool,
  LineTool,
  EyedropperTool,
  HandTool,
  ZoomTool,
} from '../core/tools';
import type { Command } from '../core/CommandSystem';
import { packRGBA } from '../core/DataModel';
import { useFrameStore } from './useFrameStore';
import { useLayerStore } from './useLayerStore';
import { useProjectStore } from './useProjectStore';
import { usePaletteStore } from './usePaletteStore';
import { useHistoryStore } from './useHistoryStore';
import { useUIStore } from './useUIStore';
import { resolveCell } from './action-composers/frame-utils';
import {
  updateScratch as bridgeUpdateScratch,
  clearScratch as bridgeClearScratch,
  uploadLayerData,
  readCompositePixel,
  DirtyFlag,
  getEngine,
} from './renderBridge';

const ZOOM_LEVELS = [1, 2, 4, 8, 16, 32] as const;

function snapZoom(current: number, direction: 'in' | 'out'): number {
  if (direction === 'in') return ZOOM_LEVELS.find((z) => z > current) ?? 32;
  return [...ZOOM_LEVELS].reverse().find((z) => z < current) ?? 1;
}

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
    setPrimaryColor: (rgba) => usePaletteStore.getState().setPrimaryColor(rgba),
    readCompositePixel: (cx, cy) => {
      const [r, g, b, a] = readCompositePixel(cx, cy);
      return packRGBA(r, g, b, a);
    },
    updateScratch: (data) => bridgeUpdateScratch(data),
    clearScratch: () => bridgeClearScratch(),
    executeCommand: (cmd: Command) => useHistoryStore.getState().execute(cmd),
    notifyLayerChanged: (layerId, data) => {
      uploadLayerData(layerId, data);
      getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
    },
    zoomToward: (cx, cy, direction) => {
      const ui = useUIStore.getState();
      const oldZoom = ui.zoomLevel;
      const newZoom = snapZoom(oldZoom, direction);
      if (newZoom === oldZoom) return;
      // Keep canvas point (cx, cy) at the same screen position:
      // newPan = oldPan + canvasPoint * (oldZoom - newZoom)
      const newPanX = ui.panOffset.x + cx * (oldZoom - newZoom);
      const newPanY = ui.panOffset.y + cy * (oldZoom - newZoom);
      ui.setZoomLevel(newZoom);
      ui.setPanOffset({ x: newPanX, y: newPanY });
    },
  };
}

export function initToolEngine(): ToolEngine {
  const ctx = buildContext();
  const engine = new ToolEngine(ctx);
  engine.registerTool(new PencilTool(ctx));
  engine.registerTool(new EraserTool(ctx));
  engine.registerTool(new LineTool(ctx));
  engine.registerTool(new EyedropperTool(ctx));
  engine.registerTool(new HandTool(ctx));
  engine.registerTool(new ZoomTool(ctx));
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
