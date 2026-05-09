import type { BlendMode, Cell, FrameId, LayerId } from '../../core/DataModel';
import { makeCell, makeLayer } from '../../core/DataModel';
import {
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  SetLayerOpacityCommand,
  SetBlendModeCommand,
  SetVisibilityCommand,
  SetLockedCommand,
  RenameLayerCommand,
  MergeDownCommand,
  type LayerCommandDeps,
} from '../../core/commands/LayerCommands';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { useProjectStore } from '../useProjectStore';
import { useHistoryStore } from '../useHistoryStore';
import {
  getEngine,
  uploadLayerData,
  DirtyFlag,
} from '../renderBridge';
import { cloneCell, resolveCell } from './frame-utils';

// Lazy-instantiated singleton — all layer commands share the same deps object
let _deps: LayerCommandDeps | null = null;

function getDeps(): LayerCommandDeps {
  if (_deps) return _deps;
  _deps = {
    insertLayer: (layer, index) =>
      useLayerStore.setState((s) => {
        const layers = [...s.layers];
        layers.splice(index, 0, layer);
        return { layers };
      }),
    removeLayer: (id) => useLayerStore.getState().removeLayer(id),
    patchLayer: (id, patch) => useLayerStore.getState().updateLayer(id, patch),
    reorderLayers: (from, to) => useLayerStore.getState().reorderLayers(from, to),
    setActiveLayer: (id) => useLayerStore.getState().setActiveLayer(id),
    setCell: (frameId, layerId, cell) =>
      useFrameStore.getState().setCell(frameId, layerId, cell),
    removeCell: (frameId, layerId) =>
      useFrameStore.setState((s) => {
        const frame = s.frames.find((f) => f.id === frameId);
        if (frame) delete frame.cells[layerId];
      }),
    invalidateLayerTexture: (layerId) => {
      // Drop the cached texture so a future re-add doesn't reuse stale data
      // (TextureCache exposes invalidate via the engine — wire when needed)
      void layerId;
    },
    notifyLayerListChanged: () => {
      const layers = useLayerStore.getState().layers;
      const engine = getEngine();
      if (!engine) return;
      engine.setLayers(
        layers.map((l) => ({
          id: l.id,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
        })),
      );
      // Re-upload pixel data for current frame so newly-added layers render
      const { frames, activeFrameIndex } = useFrameStore.getState();
      for (const layer of layers) {
        const data = resolveCell(frames, activeFrameIndex, layer.id);
        if (data) uploadLayerData(layer.id, data);
      }
      engine.markDirty(DirtyFlag.LAYER_DATA | DirtyFlag.LAYER_ORDER);
    },
  };
  return _deps;
}

// ── Public actions called by the UI ────────────────────────────────────────

export function addLayer(name?: string): void {
  const { layers, activeLayerId } = useLayerStore.getState();
  const { frames } = useFrameStore.getState();
  const { canvas } = useProjectStore.getState();
  const layer = makeLayer({ name: name ?? `Layer ${layers.length + 1}` });

  // New layer gets a fresh blank cell in every frame
  const cellsByFrame = new Map<FrameId, Cell>();
  for (const f of frames) {
    cellsByFrame.set(f.id, makeCell(canvas.width, canvas.height));
  }

  useHistoryStore
    .getState()
    .execute(
      new AddLayerCommand(
        layer,
        cellsByFrame,
        layers.length,
        activeLayerId,
        getDeps(),
      ),
    );
}

export function removeLayer(layerId: LayerId): void {
  const { layers, activeLayerId } = useLayerStore.getState();
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return;
  if (layers.length === 1) return; // refuse to delete the last layer

  const layer = layers[idx]!;
  const { frames } = useFrameStore.getState();
  const cellsByFrame = new Map<FrameId, Cell>();
  for (const f of frames) {
    const cell = f.cells[layerId];
    if (cell) cellsByFrame.set(f.id, cloneCell(cell));
  }
  const nextActive = layers[Math.max(0, idx - 1)]?.id ?? layers[idx + 1]?.id ?? null;

  useHistoryStore
    .getState()
    .execute(
      new RemoveLayerCommand(
        layer,
        cellsByFrame,
        idx,
        activeLayerId,
        nextActive ?? null,
        getDeps(),
      ),
    );
}

export function duplicateLayer(layerId: LayerId): void {
  const { layers, activeLayerId } = useLayerStore.getState();
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return;
  const src = layers[idx]!;
  const dup = makeLayer({
    name: `${src.name} copy`,
    visible: src.visible,
    locked: src.locked,
    opacity: src.opacity,
    blendMode: src.blendMode,
  });
  const { frames } = useFrameStore.getState();
  const cellsByFrame = new Map<FrameId, Cell>();
  for (const f of frames) {
    const c = f.cells[layerId];
    if (c) cellsByFrame.set(f.id, cloneCell(c));
  }
  useHistoryStore
    .getState()
    .execute(
      new AddLayerCommand(dup, cellsByFrame, idx + 1, activeLayerId, getDeps()),
    );
}

export function reorderLayer(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  useHistoryStore
    .getState()
    .execute(new ReorderLayerCommand(fromIndex, toIndex, getDeps()));
}

export function setLayerOpacity(layerId: LayerId, opacity: number): void {
  const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
  if (!layer || layer.opacity === opacity) return;
  useHistoryStore
    .getState()
    .execute(
      new SetLayerOpacityCommand(
        layerId,
        { opacity: layer.opacity },
        { opacity },
        getDeps(),
      ),
    );
}

export function setLayerBlendMode(layerId: LayerId, blendMode: BlendMode): void {
  const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
  if (!layer || layer.blendMode === blendMode) return;
  useHistoryStore
    .getState()
    .execute(
      new SetBlendModeCommand(
        layerId,
        { blendMode: layer.blendMode },
        { blendMode },
        getDeps(),
      ),
    );
}

export function setLayerVisibility(layerId: LayerId, visible: boolean): void {
  const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
  if (!layer || layer.visible === visible) return;
  useHistoryStore
    .getState()
    .execute(
      new SetVisibilityCommand(
        layerId,
        { visible: layer.visible },
        { visible },
        getDeps(),
      ),
    );
}

export function setLayerLocked(layerId: LayerId, locked: boolean): void {
  const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
  if (!layer || layer.locked === locked) return;
  useHistoryStore
    .getState()
    .execute(
      new SetLockedCommand(
        layerId,
        { locked: layer.locked },
        { locked },
        getDeps(),
      ),
    );
}

export function renameLayer(layerId: LayerId, name: string): void {
  const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
  if (!layer || layer.name === name || name.trim().length === 0) return;
  useHistoryStore
    .getState()
    .execute(
      new RenameLayerCommand(
        layerId,
        { name: layer.name },
        { name: name.trim() },
        getDeps(),
      ),
    );
}

/**
 * Merge the active layer down onto the layer immediately below it.
 * The composite (upper over lower, alpha-over per pixel) replaces the lower
 * layer's cells. The upper layer is then removed. Fully undoable.
 */
export function mergeDown(activeLayerId: LayerId): void {
  const { layers, activeLayerId: priorActive } = useLayerStore.getState();
  const upperIdx = layers.findIndex((l) => l.id === activeLayerId);
  if (upperIdx <= 0) return; // already the bottom layer
  const upperLayer = layers[upperIdx]!;
  const lowerLayer = layers[upperIdx - 1]!;
  const { frames } = useFrameStore.getState();

  const mergedCells = new Map<FrameId, Cell>();
  const upperOriginalCells = new Map<FrameId, Cell>();
  const lowerOriginalCells = new Map<FrameId, Cell>();

  for (const frame of frames) {
    const upperCell = frame.cells[upperLayer.id];
    const lowerCell = frame.cells[lowerLayer.id];
    if (upperCell) upperOriginalCells.set(frame.id, cloneCell(upperCell));
    if (lowerCell) lowerOriginalCells.set(frame.id, cloneCell(lowerCell));

    // Composite: upper over lower using normal alpha-over blend
    const upperData = resolveCell(frames, frames.indexOf(frame), upperLayer.id);
    const lowerData = resolveCell(frames, frames.indexOf(frame), lowerLayer.id);

    if (!upperData && !lowerData) continue;

    const pixelCount = upperData?.length ?? lowerData?.length ?? 0;
    if (!pixelCount) continue;
    const out = lowerData ? new Uint8ClampedArray(lowerData) : new Uint8ClampedArray(pixelCount);

    if (upperData) {
      const upperOpacity = upperLayer.opacity;
      const n = pixelCount >> 2;
      for (let p = 0; p < n; p++) {
        const i = p * 4;
        const sa = (upperData[i + 3]! / 255) * upperOpacity;
        if (sa === 0) continue;
        const da = out[i + 3]! / 255;
        const oa = sa + da * (1 - sa);
        if (oa === 0) continue;
        out[i]     = Math.round(((upperData[i]!     / 255) * sa + (out[i]!     / 255) * da * (1 - sa)) / oa * 255);
        out[i + 1] = Math.round(((upperData[i + 1]! / 255) * sa + (out[i + 1]! / 255) * da * (1 - sa)) / oa * 255);
        out[i + 2] = Math.round(((upperData[i + 2]! / 255) * sa + (out[i + 2]! / 255) * da * (1 - sa)) / oa * 255);
        out[i + 3] = Math.round(oa * 255);
      }
    }
    mergedCells.set(frame.id, { linked: false, data: out });
  }

  useHistoryStore.getState().execute(
    new MergeDownCommand(
      upperLayer,
      lowerLayer,
      upperIdx,
      mergedCells,
      lowerOriginalCells,
      upperOriginalCells,
      priorActive,
      getDeps(),
    ),
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

