/**
 * Unit tests for LassoTool.
 *
 * Covers: freehand path → scanline fill → SelectionMask, tap-no-select,
 * cancel clears path, and specific polygon shapes.
 */

import { describe, it, expect, vi } from 'vitest';
import { LassoTool } from './LassoTool';
import type { CanvasPointerEvent, ToolEngineContext } from '../ToolEngine';
import type { SelectionMask } from '../ToolEngine/types';
import type { Command } from '../CommandSystem';

// ── helpers ───────────────────────────────────────────────────────────────────

function pe(x: number, y: number): CanvasPointerEvent {
  return { canvasX: x, canvasY: y, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false };
}

function makeCtx(w: number, h: number) {
  const commands: Command[] = [];
  const state = { selection: null as SelectionMask | null };

  const ctx: ToolEngineContext = {
    getActiveLayerId: () => 'layer1',
    isActiveLayerLocked: () => false,
    getLayerData: () => new Uint8ClampedArray(w * h * 4),
    getCanvasSize: () => ({ width: w, height: h }),
    getPrimaryColor: () => 0xff0000ff,
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
    getPixelPerfect: () => false,
    getFillTolerance: () => 0,
    getMagicWandTolerance: () => 0,
    getCompositedPixels: () => null,
    computeSelectionRust: async () => null,
    getMirrorMode: () => ({ h: false, v: false }),
    setLassoPreviewPath: () => {},
    getBrushOptions: () => ({ size: 1, shape: 'square' as const }),
    snapColorIfIndexed: (c: number) => c,
  };

  return { ctx, state, commands };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LassoTool — tap (path too short)', () => {
  it('single click produces no selection', () => {
    const { ctx, state } = makeCtx(16, 16);
    const tool = new LassoTool(ctx);

    tool.onPointerDown(pe(5, 5));
    tool.onPointerUp(pe(5, 5));

    expect(state.selection).toBeNull();
  });

  it('two-point path produces no selection', () => {
    const { ctx, state } = makeCtx(16, 16);
    const tool = new LassoTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 0));
    tool.onPointerUp(pe(1, 0));

    expect(state.selection).toBeNull();
  });
});

describe('LassoTool — axis-aligned rectangle polygon', () => {
  it('lasso around a 3×3 block selects interior pixels', () => {
    const W = 10, H = 10;
    const { ctx, state } = makeCtx(W, H);
    const tool = new LassoTool(ctx);

    // Path: corners of a 4×4 square at (2,2)→(6,2)→(6,6)→(2,6)→(2,2)
    tool.onPointerDown(pe(2, 2));
    tool.onPointerMove(pe(6, 2));
    tool.onPointerMove(pe(6, 6));
    tool.onPointerMove(pe(2, 6));
    tool.onPointerUp(pe(2, 2));

    expect(state.selection).not.toBeNull();
    const sel = state.selection!;
    expect(sel.width).toBe(W);
    expect(sel.height).toBe(H);

    // Interior pixels should be selected
    expect(sel.data[3 * W + 3]).toBe(1);
    expect(sel.data[4 * W + 4]).toBe(1);
    expect(sel.data[5 * W + 5]).toBe(1);
  });

  it('pixels outside the polygon are not selected', () => {
    const W = 10, H = 10;
    const { ctx, state } = makeCtx(W, H);
    const tool = new LassoTool(ctx);

    tool.onPointerDown(pe(2, 2));
    tool.onPointerMove(pe(6, 2));
    tool.onPointerMove(pe(6, 6));
    tool.onPointerMove(pe(2, 6));
    tool.onPointerUp(pe(2, 2));

    const sel = state.selection!;
    // Corners of the canvas should not be selected
    expect(sel.data[0]).toBe(0);
    expect(sel.data[W - 1]).toBe(0);
    expect(sel.data[(H - 1) * W]).toBe(0);
  });

  it('bounds tightly wrap the selected region', () => {
    const W = 12, H = 12;
    const { ctx, state } = makeCtx(W, H);
    const tool = new LassoTool(ctx);

    // Triangle: (1,1) (8,1) (4,8)
    tool.onPointerDown(pe(1, 1));
    tool.onPointerMove(pe(8, 1));
    tool.onPointerMove(pe(4, 8));
    tool.onPointerUp(pe(1, 1));

    expect(state.selection).not.toBeNull();
    const { bounds } = state.selection!;
    expect(bounds.x).toBeGreaterThanOrEqual(1);
    expect(bounds.y).toBeGreaterThanOrEqual(1);
    expect(bounds.x + bounds.w - 1).toBeLessThanOrEqual(8);
    expect(bounds.y + bounds.h - 1).toBeLessThanOrEqual(8);
  });
});

describe('LassoTool — cancel', () => {
  it('onCancel mid-stroke clears the preview path and sets no selection', () => {
    const { ctx, state } = makeCtx(16, 16);
    const setLassoPreviewPath = vi.spyOn(ctx, 'setLassoPreviewPath');
    const tool = new LassoTool(ctx);

    tool.onPointerDown(pe(2, 2));
    tool.onPointerMove(pe(5, 2));
    tool.onPointerMove(pe(5, 5));
    tool.onCancel();

    expect(setLassoPreviewPath).toHaveBeenLastCalledWith([]);
    expect(state.selection).toBeNull();
  });

  it('subsequent pointerUp after cancel does nothing', () => {
    const { ctx, state } = makeCtx(16, 16);
    const tool = new LassoTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(4, 0));
    tool.onPointerMove(pe(4, 4));
    tool.onCancel();
    // Simulate spurious up after cancel
    tool.onPointerUp(pe(4, 4));

    expect(state.selection).toBeNull();
  });
});

describe('LassoTool — second stroke replaces selection', () => {
  it('a new lasso replaces the previous selection', () => {
    const W = 16, H = 16;
    const { ctx, state } = makeCtx(W, H);
    const tool = new LassoTool(ctx);

    // First selection: top-left region
    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(4, 0));
    tool.onPointerMove(pe(4, 4));
    tool.onPointerMove(pe(0, 4));
    tool.onPointerUp(pe(0, 0));

    const first = state.selection;
    expect(first).not.toBeNull();

    // Second selection: different region
    tool.onPointerDown(pe(8, 8));
    tool.onPointerMove(pe(14, 8));
    tool.onPointerMove(pe(14, 14));
    tool.onPointerMove(pe(8, 14));
    tool.onPointerUp(pe(8, 8));

    expect(state.selection).not.toBeNull();
    expect(state.selection).not.toBe(first);
    // New selection should not include top-left corner
    expect(state.selection!.data[0]).toBe(0);
    // Should include center of new region
    expect(state.selection!.data[11 * W + 11]).toBe(1);
  });
});

describe('LassoTool — only left button triggers draw', () => {
  it('right click (button=2) does not start a lasso', () => {
    const { ctx, state } = makeCtx(16, 16);
    const tool = new LassoTool(ctx);

    const rightClick: CanvasPointerEvent = { canvasX: 5, canvasY: 5, pressure: 1, button: 2, altKey: false, shiftKey: false, ctrlKey: false };
    tool.onPointerDown(rightClick);
    tool.onPointerMove(pe(6, 5));
    tool.onPointerMove(pe(6, 6));
    tool.onPointerUp(pe(6, 6));

    expect(state.selection).toBeNull();
  });
});
