/**
 * Unit tests for paletteActions.buildFromCanvas and countCanvasColors.
 */

import { describe, it, expect } from 'vitest';
import { buildFromCanvas, countCanvasColors } from './palette-actions';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { useProjectStore } from '../useProjectStore';
import { usePaletteStore } from '../usePaletteStore';
import { packRGBA } from '../../core/DataModel';

// ── helpers ───────────────────────────────────────────────────────────────────

const W = 8;
const H = 8;
const RED   = packRGBA(255, 0, 0, 255);
const GREEN = packRGBA(0, 255, 0, 255);
const BLUE  = packRGBA(0, 0, 255, 255);

function setupStores(paintFn?: (buf: Uint8ClampedArray) => void): Uint8ClampedArray {
  const layerId = 'layer1';
  const buf = new Uint8ClampedArray(W * H * 4);
  if (paintFn) paintFn(buf);

  useLayerStore.setState({
    layers: [{ id: layerId, name: 'Layer 1', type: 'layer' as const, parentGroupId: null, visible: true, locked: false, opacity: 1, blendMode: 'normal' as const }],
    activeLayerId: layerId,
    dataVersions: { [layerId]: 0 },
  });

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

  useProjectStore.setState((s) => ({
    ...s,
    canvas: { ...s.canvas, width: W, height: H },
  }));

  usePaletteStore.setState((s) => ({
    ...s,
    palette: { ...s.palette, swatches: [] },
  }));

  return buf;
}

function writePixelAt(buf: Uint8ClampedArray, x: number, y: number, color: number): void {
  const i = (y * W + x) * 4;
  buf[i]     = (color >>> 24) & 0xff;
  buf[i + 1] = (color >>> 16) & 0xff;
  buf[i + 2] = (color >>> 8)  & 0xff;
  buf[i + 3] = color & 0xff;
}

// ── countCanvasColors ─────────────────────────────────────────────────────────

describe('countCanvasColors', () => {
  it('returns 0 on an empty canvas', () => {
    setupStores();
    expect(countCanvasColors()).toBe(0);
  });

  it('counts one unique color', () => {
    const buf = setupStores();
    writePixelAt(buf, 2, 2, RED);
    expect(countCanvasColors()).toBe(1);
  });

  it('counts distinct colors correctly', () => {
    const buf = setupStores();
    writePixelAt(buf, 0, 0, RED);
    writePixelAt(buf, 1, 0, GREEN);
    writePixelAt(buf, 2, 0, BLUE);
    expect(countCanvasColors()).toBe(3);
  });

  it('does not count transparent pixels', () => {
    const buf = setupStores();
    writePixelAt(buf, 0, 0, RED);
    // pixel at (1,0) is fully transparent (alpha=0) — should not be counted
    const i = 1 * 4;
    buf[i] = 255; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
    expect(countCanvasColors()).toBe(1);
  });

  it('same color painted multiple times counts as 1', () => {
    const buf = setupStores();
    for (let x = 0; x < 5; x++) writePixelAt(buf, x, 0, RED);
    expect(countCanvasColors()).toBe(1);
  });

  it('skips invisible layers', () => {
    const layerId = 'layer1';
    setupStores((b) => writePixelAt(b, 0, 0, RED));

    useLayerStore.setState((s) => ({
      ...s,
      layers: s.layers.map((l) => (l.id === layerId ? { ...l, visible: false } : l)),
    }));

    expect(countCanvasColors()).toBe(0);
  });
});

// ── buildFromCanvas — replace ─────────────────────────────────────────────────

describe('buildFromCanvas replace', () => {
  it('replaces palette with canvas colors', () => {
    const buf = setupStores();
    writePixelAt(buf, 0, 0, RED);
    writePixelAt(buf, 1, 0, GREEN);

    buildFromCanvas('replace');

    const { swatches } = usePaletteStore.getState().palette;
    expect(swatches).toHaveLength(2);
    expect(swatches.map((s) => s.color)).toEqual(expect.arrayContaining([RED, GREEN]));
  });

  it('clears existing swatches before replacing', () => {
    const buf = setupStores();
    usePaletteStore.getState().addSwatch(BLUE);
    writePixelAt(buf, 0, 0, RED);

    buildFromCanvas('replace');

    const { swatches } = usePaletteStore.getState().palette;
    expect(swatches).toHaveLength(1);
    expect(swatches[0]!.color).toBe(RED);
  });

  it('does nothing on empty canvas', () => {
    setupStores();
    usePaletteStore.getState().addSwatch(BLUE);

    buildFromCanvas('replace');

    // Palette unchanged because canvas is empty
    const { swatches } = usePaletteStore.getState().palette;
    expect(swatches).toHaveLength(1);
  });
});

// ── buildFromCanvas — append ──────────────────────────────────────────────────

describe('buildFromCanvas append', () => {
  it('adds new canvas colors without removing existing swatches', () => {
    const buf = setupStores();
    usePaletteStore.getState().addSwatch(BLUE);
    writePixelAt(buf, 0, 0, RED);
    writePixelAt(buf, 1, 0, GREEN);

    buildFromCanvas('append');

    const { swatches } = usePaletteStore.getState().palette;
    expect(swatches).toHaveLength(3);
    expect(swatches.map((s) => s.color)).toEqual(expect.arrayContaining([RED, GREEN, BLUE]));
  });

  it('does not add duplicate colors that are already in the palette', () => {
    const buf = setupStores();
    usePaletteStore.getState().addSwatch(RED);
    writePixelAt(buf, 0, 0, RED);
    writePixelAt(buf, 1, 0, GREEN);

    buildFromCanvas('append');

    const { swatches } = usePaletteStore.getState().palette;
    // RED was already present — should not be duplicated
    expect(swatches.filter((s) => s.color === RED)).toHaveLength(1);
    expect(swatches.filter((s) => s.color === GREEN)).toHaveLength(1);
  });
});
