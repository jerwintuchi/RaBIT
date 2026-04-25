import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Layer, LayerId, BlendMode } from '../core/DataModel';
import { makeLayer } from '../core/DataModel';

interface LayerState {
  layers: Layer[];
  activeLayerId: LayerId | null;

  setLayers(layers: Layer[]): void;
  setActiveLayer(id: LayerId | null): void;
  addLayer(overrides?: Partial<Layer>): Layer;
  removeLayer(id: LayerId): void;
  updateLayer(id: LayerId, patch: Partial<Omit<Layer, 'id'>>): void;
  reorderLayers(fromIndex: number, toIndex: number): void;
  setVisibility(id: LayerId, visible: boolean): void;
  setLocked(id: LayerId, locked: boolean): void;
  setOpacity(id: LayerId, opacity: number): void;
  setBlendMode(id: LayerId, blendMode: BlendMode): void;
}

export const useLayerStore = create<LayerState>()(
  immer((set, get) => ({
    layers: [],
    activeLayerId: null,

    setLayers(layers) {
      set((s) => {
        s.layers = layers;
      });
    },

    setActiveLayer(id) {
      set((s) => {
        s.activeLayerId = id;
      });
    },

    addLayer(overrides = {}) {
      const layer = makeLayer({
        name: `Layer ${get().layers.length + 1}`,
        ...overrides,
      });
      set((s) => {
        s.layers.push(layer);
        s.activeLayerId = layer.id;
      });
      return layer;
    },

    removeLayer(id) {
      set((s) => {
        const idx = s.layers.findIndex((l) => l.id === id);
        if (idx === -1) return;
        s.layers.splice(idx, 1);
        if (s.activeLayerId === id) {
          s.activeLayerId = s.layers[Math.max(0, idx - 1)]?.id ?? null;
        }
      });
    },

    updateLayer(id, patch) {
      set((s) => {
        const layer = s.layers.find((l) => l.id === id);
        if (layer) Object.assign(layer, patch);
      });
    },

    reorderLayers(fromIndex, toIndex) {
      set((s) => {
        const [removed] = s.layers.splice(fromIndex, 1);
        if (removed) s.layers.splice(toIndex, 0, removed);
      });
    },

    setVisibility(id, visible) {
      set((s) => {
        const l = s.layers.find((x) => x.id === id);
        if (l) l.visible = visible;
      });
    },

    setLocked(id, locked) {
      set((s) => {
        const l = s.layers.find((x) => x.id === id);
        if (l) l.locked = locked;
      });
    },

    setOpacity(id, opacity) {
      set((s) => {
        const l = s.layers.find((x) => x.id === id);
        if (l) l.opacity = Math.min(1, Math.max(0, opacity));
      });
    },

    setBlendMode(id, blendMode) {
      set((s) => {
        const l = s.layers.find((x) => x.id === id);
        if (l) l.blendMode = blendMode;
      });
    },
  })),
);
