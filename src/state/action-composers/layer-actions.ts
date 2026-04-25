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
import { resolveCell } from './frame-utils';

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

// ── helpers ────────────────────────────────────────────────────────────────

function cloneCell(cell: Cell): Cell {
  return cell.linked
    ? { linked: true, data: null }
    : { linked: false, data: cell.data ? new Uint8ClampedArray(cell.data) : null };
}
