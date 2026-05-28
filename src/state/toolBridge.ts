// Bridges the ToolEngine into the state layer. Owns the engine singleton and
// builds a ToolEngineContext that reads from / writes to Zustand stores.
import { invoke } from '@tauri-apps/api/core';
import { perfMark, perfMeasure } from '../core/perfProbe';
import { ToolEngine } from '../core/ToolEngine';
import type { ToolEngineContext, ToolId, RawPointerInput } from '../core/ToolEngine';
import type { SelectionMask } from '../core/ToolEngine/types';
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
  MagicWandTool,
  LassoTool,
} from '../core/tools';
import type { Command } from '../core/CommandSystem';
import { packRGBA } from '../core/DataModel';
import { nearestSwatchColor } from '../core/DataModel/colorConversion';
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
  readAllCompositedPixels,
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
      uploadLayerData(layerId, data);
      getEngine()?.markDirty(DirtyFlag.LAYER_DATA | DirtyFlag.FULL);
    },
    getSelection: () => useToolStore.getState().selection,
    setSelection: (mask) => useToolStore.getState().setSelection(mask),
    clearSelection: () => useToolStore.getState().clearSelection(),
    setSelectionDragOffset: (offset) => useToolStore.getState().setSelectionDragOffset(offset),
    getPixelPerfect: () => useToolStore.getState().options.pencil.pixelPerfect,
    getFillTolerance: () => useToolStore.getState().options.fill.tolerance,
    getMagicWandTolerance: () => useToolStore.getState().options['magic-wand'].tolerance,
    getMirrorMode: () => useToolStore.getState().mirrorMode,
    setLassoPreviewPath: (path) => useToolStore.getState().setLassoPreviewPath(path),
    getBrushOptions: () => {
      const { activeTool, options } = useToolStore.getState();
      if (activeTool === 'eraser') return { size: options.eraser.size, shape: options.eraser.brushShape };
      return { size: options.pencil.size, shape: options.pencil.brushShape };
    },
    snapColorIfIndexed: (color) => {
      const { indexedMode, palette } = usePaletteStore.getState();
      if (!indexedMode || palette.swatches.length === 0) return color;
      return nearestSwatchColor(color, palette.swatches);
    },
    getCompositedPixels: () => readAllCompositedPixels(),
    computeSelectionRust: async (x: number, y: number, tolerance: number): Promise<SelectionMask | null> => {
      const pixels = readAllCompositedPixels();
      if (!pixels) return null;
      const { width, height } = useProjectStore.getState().canvas;
      type RustResult = {
        mask: number[];
        width: number;
        height: number;
        boundsX: number;
        boundsY: number;
        boundsW: number;
        boundsH: number;
      };
      try {
        const result = await invoke<RustResult>('compute_selection', {
          pixels: Array.from(pixels),
          width,
          height,
          startX: x,
          startY: y,
          tolerance,
        });
        return {
          data: new Uint8ClampedArray(result.mask),
          width: result.width,
          height: result.height,
          bounds: { x: result.boundsX, y: result.boundsY, w: result.boundsW, h: result.boundsH },
        };
      } catch {
        return null;
      }
    },
    zoomToward: (cx, cy, direction) => {
      const ui = useUIStore.getState();
      const oldZoom = ui.zoomLevel;
      const newZoom = snapZoom(oldZoom, direction);
      if (newZoom === oldZoom) return;
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
  engine.registerTool(new MagicWandTool(ctx));
  engine.registerTool(new LassoTool(ctx));
  _toolEngine = engine;
  return engine;
}

export function getToolEngine(): ToolEngine | null {
  return _toolEngine;
}

export function disposeToolEngine(): void {
  _toolEngine = null;
}

export function setToolTransform(panX: number, panY: number, zoom: number): void {
  _toolEngine?.setTransform(panX, panY, zoom);
}

export function setActiveTool(id: ToolId): void {
  _toolEngine?.setActiveTool(id);
}

export function commitFloatingSelection(): void {
  _toolEngine?.commitPendingOps();
}

export function toolPointerDown(input: RawPointerInput): void {
  perfMark();
  _toolEngine?.pointerDown(input);
  requestAnimationFrame(() => perfMeasure('pointerDown->RAF'));
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
