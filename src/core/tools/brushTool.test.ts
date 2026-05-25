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
import { packRGBA, readPixel, writePixel } from '../DataModel';
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
  opts: { pixelPerfect?: boolean; mirror?: { h: boolean; v: boolean } } = {},
) {
  const layerBuf = new Uint8ClampedArray(w * h * 4);
  const commands: Command[] = [];
  const state = { selection: null as SelectionMask | null };
  const pixelPerfect = opts.pixelPerfect ?? false;
  const mirror = opts.mirror ?? { h: false, v: false };

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
