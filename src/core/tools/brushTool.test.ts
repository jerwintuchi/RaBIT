/**
 * Unit tests for BrushTool pixel-perfect mode.
 *
 * Pixel-perfect removes L-shaped "elbow" pixels from diagonal strokes so
 * that diagonals look like true 1-pixel-wide lines. The middle pixel of
 * three consecutive points that form an L (one axis shared between each
 * adjacent pair, but outer two are diagonal) is erased from both the
 * scratch buffer and the delta map (so undo is correct).
 */

import { describe, it, expect } from 'vitest';
import { PencilTool } from './PencilTool';
import { packRGBA, readPixel, writePixel, unpackRGBA } from '../DataModel';
import type { CanvasPointerEvent, ToolEngineContext } from '../ToolEngine';
import type { SelectionMask } from '../ToolEngine/types';
import type { Command } from '../CommandSystem';

// ── helpers ───────────────────────────────────────────────────────────────────

const RED = packRGBA(255, 0, 0, 255);

function pe(x: number, y: number): CanvasPointerEvent {
  return { canvasX: x, canvasY: y, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false };
}

function makeCtx(
  w: number,
  h: number,
  opts: {
    pixelPerfect?: boolean;
    mirror?: { h: boolean; v: boolean };
    brushSize?: number;
    brushShape?: import('../DataModel').BrushShape;
    snapColor?: (c: number) => number;
  } = {},
) {
  const layerBuf = new Uint8ClampedArray(w * h * 4);
  const commands: Command[] = [];
  const state = { selection: null as SelectionMask | null };
  const pixelPerfect = opts.pixelPerfect ?? false;
  const mirror = opts.mirror ?? { h: false, v: false };
  const brushSize = opts.brushSize ?? 1;
  const brushShape = opts.brushShape ?? 'square';

  const ctx: ToolEngineContext = {
    getActiveLayerId: () => 'layer1',
    isActiveLayerLocked: () => false,
    getLayerData: () => layerBuf,
    getCanvasSize: () => ({ width: w, height: h }),
    getPrimaryColor: () => RED,
    setPrimaryColor: () => {},
    readCompositePixel: () => 0,
    updateScratch: () => {},
    clearScratch: () => {},
    setScratchErase: () => {},
    executeCommand: (cmd) => { cmd.execute(); commands.push(cmd); },
    notifyLayerChanged: () => {},
    previewLayerOnGPU: () => {},
    zoomToward: () => {},
    getSelection: () => state.selection,
    setSelection: (mask) => { state.selection = mask; },
    clearSelection: () => { state.selection = null; },
    setSelectionDragOffset: () => {},
    getPixelPerfect: () => pixelPerfect,
    getFillTolerance: () => 0,
    getMagicWandTolerance: () => 0,
    getCompositedPixels: () => null,
    computeSelectionRust: async () => null,
    getMirrorMode: () => mirror,
    setLassoPreviewPath: () => {},
    getBrushOptions: () => ({ size: brushSize, shape: brushShape as import('../DataModel').BrushShape }),
    snapColorIfIndexed: opts.snapColor ?? ((c: number) => c),
  };

  return { ctx, layerBuf, commands };
}

/** Collect all painted pixel positions from a DrawCommand's delta list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paintedPixels(cmd: Command): { x: number; y: number }[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cmd as any).deltas
    .filter((d: any) => d.after !== 0)
    .map((d: any) => ({ x: d.x, y: d.y }));
}

// ── pixel-perfect OFF (baseline) ──────────────────────────────────────────────

describe('BrushTool — pixel-perfect OFF', () => {
  it('45° diagonal produces elbows (baseline without pixel-perfect)', () => {
    // Draw a short diagonal: (0,0) → (1,0) → (1,1) which is an L-shape.
    // With PP off, all 3 pixels should be in the DrawCommand.
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: false });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 0));  // right
    tool.onPointerMove(pe(1, 1));  // down — elbow at (1,0)
    tool.onPointerUp(pe(1, 1));

    const pixels = paintedPixels(commands[0]!);
    // All 3 positions should be painted
    expect(pixels.some((p) => p.x === 0 && p.y === 0)).toBe(true);
    expect(pixels.some((p) => p.x === 1 && p.y === 0)).toBe(true); // elbow present
    expect(pixels.some((p) => p.x === 1 && p.y === 1)).toBe(true);
  });
});

// ── pixel-perfect ON ──────────────────────────────────────────────────────────

describe('BrushTool — pixel-perfect ON', () => {
  it('removes the elbow pixel from a horizontal-then-vertical L', () => {
    // Path: (0,0) → (1,0) → (1,1): horizontal then vertical — elbow at (1,0)
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 0));
    tool.onPointerMove(pe(1, 1));
    tool.onPointerUp(pe(1, 1));

    const pixels = paintedPixels(commands[0]!);
    expect(pixels.some((p) => p.x === 1 && p.y === 0)).toBe(false); // elbow removed
    expect(pixels.some((p) => p.x === 0 && p.y === 0)).toBe(true);
    expect(pixels.some((p) => p.x === 1 && p.y === 1)).toBe(true);
  });

  it('removes the elbow pixel from a vertical-then-horizontal L', () => {
    // Path: (0,0) → (0,1) → (1,1): vertical then horizontal — elbow at (0,1)
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(0, 1));
    tool.onPointerMove(pe(1, 1));
    tool.onPointerUp(pe(1, 1));

    const pixels = paintedPixels(commands[0]!);
    expect(pixels.some((p) => p.x === 0 && p.y === 1)).toBe(false); // elbow removed
    expect(pixels.some((p) => p.x === 0 && p.y === 0)).toBe(true);
    expect(pixels.some((p) => p.x === 1 && p.y === 1)).toBe(true);
  });

  it('single pixel click — no elbow check, one pixel painted', () => {
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(3, 3));

    expect(commands).toHaveLength(1);
    expect(paintedPixels(commands[0]!)).toHaveLength(1);
    expect(paintedPixels(commands[0]!)[0]).toEqual({ x: 3, y: 3 });
  });

  it('perfectly horizontal stroke — no pixels removed', () => {
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 0));
    tool.onPointerMove(pe(2, 0));
    tool.onPointerMove(pe(3, 0));
    tool.onPointerUp(pe(3, 0));

    // All 4 pixels should be present — no elbows in a straight line
    const pixels = paintedPixels(commands[0]!);
    expect(pixels).toHaveLength(4);
  });

  it('perfectly vertical stroke — no pixels removed', () => {
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(2, 0));
    tool.onPointerMove(pe(2, 1));
    tool.onPointerMove(pe(2, 2));
    tool.onPointerMove(pe(2, 3));
    tool.onPointerUp(pe(2, 3));

    const pixels = paintedPixels(commands[0]!);
    expect(pixels).toHaveLength(4);
  });

  it('true 45° diagonal — no elbows produced', () => {
    // (0,0) → (1,1) → (2,2): each step is diagonal, no shared-axis transitions
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 1));
    tool.onPointerMove(pe(2, 2));
    tool.onPointerUp(pe(2, 2));

    // Bresenham plots (0,0),(1,1),(2,2) — no L-shapes, nothing removed
    const pixels = paintedPixels(commands[0]!);
    expect(pixels.some((p) => p.x === 0 && p.y === 0)).toBe(true);
    expect(pixels.some((p) => p.x === 1 && p.y === 1)).toBe(true);
    expect(pixels.some((p) => p.x === 2 && p.y === 2)).toBe(true);
  });

  it('undo after pixel-perfect stroke does not include removed elbow', () => {
    const W = 8, H = 8;
    const { ctx, layerBuf, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    // Pre-paint something at the elbow position so we can verify undo restores it
    writePixel(layerBuf, 1, 0, W, packRGBA(0, 255, 0, 255)); // green at elbow

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 0)); // would be elbow
    tool.onPointerMove(pe(1, 1));
    tool.onPointerUp(pe(1, 1));

    // Elbow pixel (1,0) should NOT be in the command (it was removed)
    const pixels = paintedPixels(commands[0]!);
    expect(pixels.some((p) => p.x === 1 && p.y === 0)).toBe(false);

    // After undo, (1,0) should still be green (never modified by the stroke)
    commands[0]!.undo();
    expect(readPixel(layerBuf, 1, 0, W)).toBe(packRGBA(0, 255, 0, 255));
  });

  it('history resets between strokes — second stroke has independent elbow detection', () => {
    const W = 8, H = 8;
    const { ctx, commands } = makeCtx(W, H, { pixelPerfect: true });
    const tool = new PencilTool(ctx);

    // First stroke: creates an elbow
    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 0));
    tool.onPointerMove(pe(1, 1));
    tool.onPointerUp(pe(1, 1));

    // Second stroke: starts fresh — first two pixels should never be elbow-removed
    tool.onPointerDown(pe(4, 4));
    tool.onPointerMove(pe(5, 4));
    tool.onPointerMove(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    expect(commands).toHaveLength(2);
    // Elbow removed in each stroke independently
    expect(paintedPixels(commands[1]!).some((p) => p.x === 5 && p.y === 4)).toBe(false);
    expect(paintedPixels(commands[1]!).some((p) => p.x === 4 && p.y === 4)).toBe(true);
    expect(paintedPixels(commands[1]!).some((p) => p.x === 5 && p.y === 5)).toBe(true);
  });
});

// ── computeOffsets — square shape ────────────────────────────────────────────

describe('BrushTool.computeOffsets — square', () => {
  const { ctx } = makeCtx(20, 20);
  const tool = new PencilTool(ctx);

  it('size 1 → 1 pixel', () => {
    const offsets = tool.computeOffsets(1, 'square');
    expect(offsets).toHaveLength(1);
    expect(offsets[0]).toEqual({ dx: 0, dy: 0 });
  });

  it('size 2 → exactly 4 pixels (2×2)', () => {
    const offsets = tool.computeOffsets(2, 'square');
    expect(offsets).toHaveLength(4);
  });

  it('size 3 → exactly 9 pixels (3×3)', () => {
    const offsets = tool.computeOffsets(3, 'square');
    expect(offsets).toHaveLength(9);
  });

  it('size 5 → exactly 25 pixels (5×5)', () => {
    const offsets = tool.computeOffsets(5, 'square');
    expect(offsets).toHaveLength(25);
  });

  it('size 16 → exactly 256 pixels (16×16)', () => {
    const offsets = tool.computeOffsets(16, 'square');
    expect(offsets).toHaveLength(256);
  });

  it('size 2 offsets start at (0,0) — asymmetric half for even size', () => {
    const offsets = tool.computeOffsets(2, 'square');
    expect(offsets.some((o) => o.dx === 0 && o.dy === 0)).toBe(true);
    expect(offsets.some((o) => o.dx === 1 && o.dy === 1)).toBe(true);
    expect(offsets.some((o) => o.dx === -1)).toBe(false);
  });
});

// ── computeOffsets — round shape ─────────────────────────────────────────────

describe('BrushTool.computeOffsets — round', () => {
  const { ctx } = makeCtx(20, 20);
  const tool = new PencilTool(ctx);

  it('size 3 round → 5 pixels (plus shape)', () => {
    const offsets = tool.computeOffsets(3, 'round');
    expect(offsets).toHaveLength(5);
  });

  it('size 5 round → 13 pixels', () => {
    const offsets = tool.computeOffsets(5, 'round');
    expect(offsets).toHaveLength(13);
  });

  it('round offsets exclude corners — (±hi, ±hi) absent for size 3', () => {
    const offsets = tool.computeOffsets(3, 'round');
    expect(offsets.some((o) => o.dx === 1 && o.dy === 1)).toBe(false);
    expect(offsets.some((o) => o.dx === -1 && o.dy === -1)).toBe(false);
  });
});

// ── multi-pixel brush painting ────────────────────────────────────────────────

describe('BrushTool — multi-pixel footprint', () => {
  it('size 3 square single click paints 9 pixels centered at cursor', () => {
    const W = 20, H = 20;
    const { ctx, commands } = makeCtx(W, H, { brushSize: 3, brushShape: 'square' });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    const pixels = paintedPixels(commands[0]!);
    expect(pixels).toHaveLength(9);
    // Center pixel
    expect(pixels.some((p) => p.x === 5 && p.y === 5)).toBe(true);
    // All corners of 3×3 centered at (5,5)
    expect(pixels.some((p) => p.x === 4 && p.y === 4)).toBe(true);
    expect(pixels.some((p) => p.x === 6 && p.y === 6)).toBe(true);
  });

  it('size 2 square single click paints 4 pixels (not 9)', () => {
    const W = 20, H = 20;
    const { ctx, commands } = makeCtx(W, H, { brushSize: 2, brushShape: 'square' });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    expect(paintedPixels(commands[0]!)).toHaveLength(4);
  });

  it('size 3 round single click paints 5 pixels', () => {
    const W = 20, H = 20;
    const { ctx, commands } = makeCtx(W, H, { brushSize: 3, brushShape: 'round' });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    expect(paintedPixels(commands[0]!)).toHaveLength(5);
  });

  it('pixel-perfect does not override multi-pixel brush size in the engine (UI enforces size 1 via disabled chips)', () => {
    // PP mode only enables elbow removal when offsets.length === 1.
    // getBrushOptions() returns the raw configured size; it does not clamp to 1.
    const W = 20, H = 20;
    const { ctx, commands } = makeCtx(W, H, { brushSize: 5, brushShape: 'square', pixelPerfect: true });
    const tool = new PencilTool(ctx);

    tool.onPointerDown(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    expect(paintedPixels(commands[0]!)).toHaveLength(25); // 5×5 footprint, PP has no effect at this size
  });
});

// ── snapColorIfIndexed ────────────────────────────────────────────────────────

describe('BrushTool — snapColorIfIndexed', () => {
  const BLUE  = packRGBA(0,   0,   255, 255);
  const RED   = packRGBA(255, 0,   0,   255);
  const GREEN = packRGBA(0,   255, 0,   255);

  it('passes color through unchanged when snap function is identity', () => {
    const W = 10, H = 10;
    const { ctx, commands } = makeCtx(W, H, {
      snapColor: (c) => c,
    });
    // Override primary to BLUE
    ctx.getPrimaryColor = () => BLUE;
    const tool = new PencilTool(ctx);
    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(2, 2));

    const [delta] = (commands[0] as any).deltas;
    const [r, g, b] = unpackRGBA(delta.after as number);
    expect(r).toBe(0); expect(g).toBe(0); expect(b).toBe(255);
  });

  it('snaps color to nearest when indexed mode is active', () => {
    const W = 10, H = 10;
    // snapColor replaces BLUE-ish with RED (simulating nearest-swatch snap)
    const { ctx, commands } = makeCtx(W, H, {
      snapColor: () => RED,
    });
    ctx.getPrimaryColor = () => BLUE;
    const tool = new PencilTool(ctx);
    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(2, 2));

    const [delta] = (commands[0] as any).deltas;
    const [r, g, b] = unpackRGBA(delta.after as number);
    expect(r).toBe(255); expect(g).toBe(0); expect(b).toBe(0);
  });

  it('all pixels in a multi-pixel stroke use the snapped color', () => {
    const W = 20, H = 20;
    const { ctx, commands } = makeCtx(W, H, {
      brushSize: 3,
      brushShape: 'square',
      snapColor: () => GREEN,
    });
    ctx.getPrimaryColor = () => BLUE;
    const tool = new PencilTool(ctx);
    tool.onPointerDown(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    const pixels = paintedPixels(commands[0]!);
    expect(pixels).toHaveLength(9);
    for (const d of (commands[0] as any).deltas.filter((x: any) => x.after !== 0)) {
      const [r, , b] = unpackRGBA(d.after as number);
      expect(r).toBe(0); expect(b).toBe(0); // green: r=0, b=0
    }
  });
});
