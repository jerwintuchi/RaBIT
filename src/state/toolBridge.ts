// Bridges the ToolEngine into the state layer. Owns the engine singleton and
// builds a ToolEngineContext that reads from / writes to Zustand stores.
import { perfMark, perfMeasure } from '../core/perfProbe';
import { ToolEngine } from '../core/ToolEngine';
import type { ToolEngineContext, ToolId, RawPointerInput } from '../core/ToolEngine';
import {
  PencilTool,
  EraserTool,
  LineTool,
  RectangleTool,
  EllipseTool,
  FillTool,
  MoveTool,
  MarqueeTool,
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
import { useToolStore } from './useToolStore';
import { resolveCell } from './action-composers/frame-utils';
import {
  updateScratch as bridgeUpdateScratch,
  clearScratch as bridgeClearScratch,
  setScratchErase as bridgeSetScratchErase,
  setActiveLayerOnEngine,
  uploadLayerData,
  readCompositePixel,
  DirtyFlag,
  getEngine,
} from './renderBridge';
import { snapZoom } from './zoomLevels';

let _toolEngine: ToolEngine | null = null;

function buildContext(): ToolEngineContext {
  return {
    getActiveLayerId: () => useLayerStore.getState().activeLayerId,
    isActiveLayerLocked: () => {
      const { layers, activeLayerId } = useLayerStore.getState();
      return layers.find((l) => l.id === activeLayerId)?.locked === true;
    },
    getLayerData: (layerId) => {
      const { frames, activeFrameIndex } = useFrameStore.getState();
      return resolveCell(frames, activeFrameIndex, layerId);
    },
    getCanvasSize: () => {
      const { width, height } = useProjectStore.getState().canvas;
      return { width, height };
    },
    getPrimaryColor: () => usePaletteStore.getState().primaryColor,
    setPrimaryColor: (rgba) => {
      const store = usePaletteStore.getState();
      store.pushColorHistory(store.primaryColor);
      store.setPrimaryColor(rgba);
    },
    readCompositePixel: (cx, cy) => {
      const [r, g, b, a] = readCompositePixel(cx, cy);
      return packRGBA(r, g, b, a);
    },
    updateScratch: (data) => bridgeUpdateScratch(data),
    clearScratch: () => bridgeClearScratch(),
    setScratchErase: (on) => {
      if (on) setActiveLayerOnEngine(useLayerStore.getState().activeLayerId ?? '');
      bridgeSetScratchErase(on);
    },
    executeCommand: (cmd: Command) => useHistoryStore.getState().execute(cmd),
    notifyLayerChanged: (layerId, data) => {
      uploadLayerData(layerId, data);
      getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
      // Signal subscribers (e.g. thumbnails) that this layer's pixels changed
      useLayerStore.getState().bumpDataVersion(layerId);
    },
    previewLayerOnGPU: (layerId, data) => {
      // Upload directly to GPU — does NOT touch the store or data versions.
      // Used for live move-preview so original selection pixels vanish while dragging.
      uploadLayerData(layerId, data);
      getEngine()?.markDirty(DirtyFlag.LAYER_DATA | DirtyFlag.FULL);
    },
    getSelection: () => useToolStore.getState().selection,
    setSelection: (mask) => useToolStore.getState().setSelection(mask),
    clearSelection: () => useToolStore.getState().clearSelection(),
    getFillTolerance: () => useToolStore.getState().options.fill.tolerance,
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
  engine.registerTool(new RectangleTool(ctx));
  engine.registerTool(new EllipseTool(ctx));
  engine.registerTool(new FillTool(ctx));
  engine.registerTool(new MoveTool(ctx));
  engine.registerTool(new MarqueeTool(ctx));
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
  perfMark();
  _toolEngine?.pointerDown(input);
  requestAnimationFrame(() => perfMeasure('pointerDown→RAF'));
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
