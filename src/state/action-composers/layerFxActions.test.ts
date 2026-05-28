/**
 * Unit tests for outlineLayer().
 *
 * Uses real Zustand stores (in-memory) and mocks only the renderBridge
 * side-effects that touch GPU / Tauri.
 */

import { describe, it, expect, vi } from 'vitest';
import { outlineLayer } from './layerFxActions';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { useProjectStore } from '../useProjectStore';
import { usePaletteStore } from '../usePaletteStore';
import { useHistoryStore } from '../useHistoryStore';
import { packRGBA, readPixel } from '../../core/DataModel';

// Mock renderBridge — outlineLayer calls uploadLayerData and getEngine.
vi.mock('../renderBridge', () => ({
  uploadLayerData: vi.fn(),
  getEngine: vi.fn(() => ({ markDirty: vi.fn() })),
  DirtyFlag: { LAYER_DATA: 1, FULL: 2 },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const W = 8;
const H = 8;
const RED = packRGBA(255, 0, 0, 255);
const BLACK = packRGBA(0, 0, 0, 255);

function setupStores(paintFn?: (buf: Uint8ClampedArray) => void): {
  buf: Uint8ClampedArray;
  layerId: string;
} {
  // Reset stores to a known state.
  const layerId = 'test-layer';
  const buf = new Uint8ClampedArray(W * H * 4);
  if (paintFn) paintFn(buf);

  // Layer store
  useLayerStore.setState({
    layers: [{ id: layerId, name: 'Layer 1', type: 'layer' as const, parentGroupId: null, visible: true, locked: false, opacity: 1, blendMode: 'normal' as const }],
    activeLayerId: layerId,
    dataVersions: { [layerId]: 0 },
  });

  // Frame store — one frame with a direct (non-linked) cell
  useFrameStore.setState({
    frames: [{
      id: 'frame1',
      duration: 100,
      cells: { [layerId]: { linked: false, data: buf } },
      hiddenLayerIds: [],
    }],
    activeFrameIndex: 0,
    tags: [],
    playback: { playing: false, fps: 12, loop: true },
  });

  // Project store
  useProjectStore.setState((s) => ({
    ...s,
    canvas: { ...s.canvas, width: W, height: H },
  }));

  // Palette — primary color BLACK for outline
  usePaletteStore.setState((s) => ({ ...s, primaryColor: BLACK }));

  // History — clear via the manager
  useHistoryStore.getState().clear();

  return { buf, layerId };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('outlineLayer — no opaque pixels', () => {
  it('does nothing on an all-transparent layer', () => {
    const { buf } = setupStores();
    const initialBuf = new Uint8ClampedArray(buf);

    outlineLayer();

    // Buffer should be unchanged
    expect(buf).toEqual(initialBuf);
    expect(useHistoryStore.getState().undoCount).toBe(0);
  });
});

describe('outlineLayer — single opaque pixel', () => {
  it('places outline on all 4 transparent neighbors', () => {
    const { buf } = setupStores((b) => {
      // Paint a single red pixel at (4, 4)
      const i = (4 * W + 4) * 4;
      b[i] = 255; b[i + 1] = 0; b[i + 2] = 0; b[i + 3] = 255;
    });

    outlineLayer();

    // Execute the DrawCommand that was queued
    const history = useHistoryStore.getState();
    expect(history.undoCount).toBe(1);

    // Check that the 4 neighbors got the outline color (BLACK)
    expect(readPixel(buf, 3, 4, W)).toBe(BLACK); // left
    expect(readPixel(buf, 5, 4, W)).toBe(BLACK); // right
    expect(readPixel(buf, 4, 3, W)).toBe(BLACK); // up
    expect(readPixel(buf, 4, 5, W)).toBe(BLACK); // down
  });

  it('does not overwrite the original opaque pixel', () => {
    const { buf } = setupStores((b) => {
      const i = (4 * W + 4) * 4;
      b[i] = 255; b[i + 1] = 0; b[i + 2] = 0; b[i + 3] = 255;
    });

    outlineLayer();

    expect(readPixel(buf, 4, 4, W)).toBe(RED);
  });

  it('edge pixels — neighbors outside canvas are not added', () => {
    const { buf } = setupStores((b) => {
      // Pixel at top-left corner (0, 0)
      b[3] = 255; // alpha only, RGBA = (0,0,0,255) ... let's use full RED
      const i = 0;
      b[i] = 255; b[i + 1] = 0; b[i + 2] = 0; b[i + 3] = 255;
    });

    outlineLayer();

    // Only right (1,0) and bottom (0,1) neighbors should be outlined
    expect(readPixel(buf, 1, 0, W)).toBe(BLACK);
    expect(readPixel(buf, 0, 1, W)).toBe(BLACK);
    // The opaque pixel itself is untouched
    expect(readPixel(buf, 0, 0, W)).toBe(RED);
    // No pixel at (-1,0) or (0,-1) was created
  });
});

describe('outlineLayer — already-outlined pixels not double-outlined', () => {
  it('transparent pixel adjacent to two opaque pixels only gets one outline delta', () => {
    const { buf } = setupStores((b) => {
      // Two horizontally adjacent opaque pixels at (3,3) and (5,3) with gap at (4,3)
      const i1 = (3 * W + 3) * 4;
      b[i1] = 255; b[i1 + 3] = 255;
      const i2 = (3 * W + 5) * 4;
      b[i2] = 255; b[i2 + 3] = 255;
    });

    outlineLayer();

    // (4,3) is transparent but adjacent to both — should be outlined once
    expect(readPixel(buf, 4, 3, W)).toBe(BLACK);
    // And undo should restore it to transparent
    useHistoryStore.getState().undo();
    expect(readPixel(buf, 4, 3, W)).toBe(0);
  });
});

describe('outlineLayer — undo', () => {
  it('undo removes all outline pixels', () => {
    const { buf } = setupStores((b) => {
      const i = (4 * W + 4) * 4;
      b[i] = 255; b[i + 1] = 0; b[i + 2] = 0; b[i + 3] = 255;
    });

    outlineLayer();

    // Neighbors got outlined
    expect(readPixel(buf, 3, 4, W)).toBe(BLACK);

    // Undo
    useHistoryStore.getState().undo();

    // Outline pixels gone
    expect(readPixel(buf, 3, 4, W)).toBe(0);
    expect(readPixel(buf, 5, 4, W)).toBe(0);
  });
});

describe('outlineLayer — locked layer', () => {
  it('does nothing when the active layer is locked', () => {
    setupStores((b) => {
      const i = (4 * W + 4) * 4;
      b[i] = 255; b[i + 3] = 255;
    });

    useLayerStore.setState((s) => ({
      ...s,
      layers: s.layers.map((l) => ({ ...l, locked: true })),
    }));

    outlineLayer();

    expect(useHistoryStore.getState().undoCount).toBe(0);
  });
});
