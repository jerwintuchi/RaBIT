/**
 * Unit tests for MoveTool and MarqueeTool.
 *
 * Tests the non-destructive floating-selection model:
 *   - No DrawCommand per drop; one DrawCommand on commit (deactivate/explicit commit)
 *   - Re-drag accumulates offset without double-counting
 *   - Off-canvas drops revert to pre-drag snapshot without corrupting the float
 *   - onCancel cancels the active drag segment but keeps the float alive
 *   - Second onCancel (with no active drag) cancels the entire float
 *   - Undo after commit restores original pixel positions
 */

import { describe, it, expect } from 'vitest';
import { MoveTool } from './MoveTool';
import { MarqueeTool } from './MarqueeTool';
import { packRGBA, readPixel, writePixel } from '../DataModel';
import type { CanvasPointerEvent, ToolEngineContext } from '../ToolEngine';
import type { SelectionMask } from '../ToolEngine/types';
import type { Command } from '../CommandSystem';

// ── Test helpers ──────────────────────────────────────────────────────────────

const RED = packRGBA(255, 0, 0, 255);

function pe(x: number, y: number, button: 0 | 1 | 2 = 0): CanvasPointerEvent {
  return { canvasX: x, canvasY: y, pressure: 1, button, altKey: false, shiftKey: false, ctrlKey: false };
}

function makeBuf(w: number, h: number, pixels: Array<{ x: number; y: number; color: number }> = []) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (const { x, y, color } of pixels) writePixel(buf, x, y, w, color);
  return buf;
}

function makeSelMask(
  w: number,
  h: number,
  pixels: Array<{ x: number; y: number }>,
): SelectionMask {
  const data = new Uint8ClampedArray(w * h);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { x, y } of pixels) {
    data[y * w + x] = 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    data,
    width: w,
    height: h,
    bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

interface TestCtx {
  ctx: ToolEngineContext;
  layerBuf: Uint8ClampedArray;
  commands: Command[];
  state: { selection: SelectionMask | null };
}

function makeCtx(w: number, h: number, buf?: Uint8ClampedArray): TestCtx {
  const layerBuf = buf ?? new Uint8ClampedArray(w * h * 4);
  const commands: Command[] = [];
  const state = { selection: null as SelectionMask | null };

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
    executeCommand: (cmd) => {
      cmd.execute();
      commands.push(cmd);
    },
    notifyLayerChanged: () => {},
    previewLayerOnGPU: () => {},
    zoomToward: () => {},
    getSelection: () => state.selection,
    setSelection: (mask) => {
      state.selection = mask;
    },
    clearSelection: () => {
      state.selection = null;
    },
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

  return { ctx, layerBuf, commands, state };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const priv = (tool: object) => tool as any;

// ── MoveTool ──────────────────────────────────────────────────────────────────

describe('MoveTool — no active selection', () => {
  const W = 8, H = 8;

  it('commits one DrawCommand on pointer-up and moves the pixel', () => {
    const buf = makeBuf(W, H, [{ x: 2, y: 2, color: RED }]);
    const { ctx, layerBuf, commands } = makeCtx(W, H, buf);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(2, 2));
    tool.onPointerMove(pe(4, 4));
    tool.onPointerUp(pe(4, 4));

    expect(commands).toHaveLength(1);
    expect(readPixel(layerBuf, 2, 2, W)).toBe(0);        // source cleared
    expect(readPixel(layerBuf, 4, 4, W)).toBe(RED);      // pixel at destination
  });

  it('undo restores pixel to original position', () => {
    const buf = makeBuf(W, H, [{ x: 2, y: 2, color: RED }]);
    const { ctx, layerBuf, commands } = makeCtx(W, H, buf);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(5, 5));
    commands[0]!.undo();

    expect(readPixel(layerBuf, 2, 2, W)).toBe(RED);
    expect(readPixel(layerBuf, 5, 5, W)).toBe(0);
  });

  it('each drop produces one DrawCommand (two drops = two commands)', () => {
    const buf = makeBuf(W, H, [{ x: 1, y: 1, color: RED }]);
    const { ctx, commands } = makeCtx(W, H, buf);
    const tool = new MoveTool(ctx);

    // First drop: (1,1) → (2,2)
    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(2, 2));

    // Second drop: (2,2) → (3,3)
    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(3, 3));

    expect(commands).toHaveLength(2);
  });

  it('drag where all pixels end off-canvas still commits (clips at edges)', () => {
    const buf = makeBuf(W, H, [{ x: 0, y: 0, color: RED }]);
    const { ctx, commands } = makeCtx(W, H, buf);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(0, 0));
    tool.onPointerUp(pe(20, 20)); // off-canvas

    // No-selection path always commits immediately, pixels are clipped at commit
    expect(commands).toHaveLength(1);
  });
});

describe('MoveTool — with active selection (floating model)', () => {
  const W = 8, H = 8;

  it('produces no DrawCommand on drop — float stays alive', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(5, 5));

    expect(commands).toHaveLength(0);
    expect(priv(tool)._floating).not.toBeNull();
  });

  it('re-drag accumulates offset without double-counting', () => {
    const buf = makeBuf(W, H, [{ x: 2, y: 2, color: RED }]);
    const { ctx, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 2, y: 2 }]);
    const tool = new MoveTool(ctx);

    // First drag: (2,2) → (3,3), offset = (1,1)
    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(3, 3));
    expect(priv(tool)._floating.currentDx).toBe(1);
    expect(priv(tool)._floating.currentDy).toBe(1);

    // Second drag: (3,3) → (4,4), offset = (2,2)
    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(4, 4));
    expect(priv(tool)._floating.currentDx).toBe(2);
    expect(priv(tool)._floating.currentDy).toBe(2);
  });

  it('onDeactivate commits float as one DrawCommand', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(5, 5));
    tool.onDeactivate();

    expect(commands).toHaveLength(1);
    expect(readPixel(layerBuf, 3, 3, W)).toBe(0);
    expect(readPixel(layerBuf, 5, 5, W)).toBe(RED);
    expect(priv(tool)._floating).toBeNull();
  });

  it('undo after commit restores original pixel positions', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(5, 5));
    tool.onDeactivate();
    commands[0]!.undo();

    expect(readPixel(layerBuf, 3, 3, W)).toBe(RED);
    expect(readPixel(layerBuf, 5, 5, W)).toBe(0);
  });

  it('multi-segment float commits single DrawCommand covering full delta', () => {
    const buf = makeBuf(W, H, [{ x: 1, y: 1, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 1, y: 1 }]);
    const tool = new MoveTool(ctx);

    // Drag 1: +1,+1
    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(2, 2));
    // Drag 2: +1,+1 more
    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(3, 3));

    tool.onDeactivate();

    expect(commands).toHaveLength(1);
    expect(readPixel(layerBuf, 1, 1, W)).toBe(0);
    expect(readPixel(layerBuf, 3, 3, W)).toBe(RED);
  });

  it('off-canvas drop reverts background snapshot, float stays at last valid position', () => {
    const W2 = 4, H2 = 4;
    const buf = makeBuf(W2, H2, [{ x: 1, y: 1, color: RED }]);
    const { ctx, commands, state } = makeCtx(W2, H2, buf);
    state.selection = makeSelMask(W2, H2, [{ x: 1, y: 1 }]);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(20, 20)); // off-canvas

    expect(commands).toHaveLength(0);
    // Float stays alive
    const floating = priv(tool)._floating;
    expect(floating).not.toBeNull();
    // Offset not advanced (drop was rejected)
    expect(floating.currentDx).toBe(0);
    expect(floating.currentDy).toBe(0);
  });

  it('cancel during drag reverts segment only — float stays alive', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MoveTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerMove(pe(5, 5));
    tool.onCancel(); // cancel mid-drag

    // Float still alive at original offset (0,0)
    const floating = priv(tool)._floating;
    expect(floating).not.toBeNull();
    expect(floating.currentDx).toBe(0);
    expect(floating.currentDy).toBe(0);
    expect(priv(tool).active).toBe(false);
  });

  it('cancel with no active drag cancels entire float and restores original layer', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, commands, state } = makeCtx(W, H, buf);
    const origSel = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    state.selection = origSel;
    const tool = new MoveTool(ctx);

    // Complete a drop so float is alive but not actively dragging
    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(4, 4));

    // Cancel entire float
    tool.onCancel();

    expect(commands).toHaveLength(0); // no commit
    expect(priv(tool)._floating).toBeNull();
    // Selection restored to original
    expect(state.selection).toBe(origSel);
  });
});

// ── MarqueeTool ───────────────────────────────────────────────────────────────

describe('MarqueeTool — selection drawing', () => {
  const W = 8, H = 8;

  it('creates correct bounds on fresh canvas (no existing selection)', () => {
    const { ctx, state } = makeCtx(W, H);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(2, 2));
    tool.onPointerMove(pe(4, 4));
    tool.onPointerUp(pe(4, 4));

    expect(state.selection).not.toBeNull();
    expect(state.selection!.bounds).toEqual({ x: 2, y: 2, w: 3, h: 3 });
    // Every pixel in the rect is selected
    for (let y = 2; y <= 4; y++)
      for (let x = 2; x <= 4; x++)
        expect(state.selection!.data[y * W + x]).toBe(1);
  });

  it('clamps selection bounds to canvas edges when dragging beyond', () => {
    const W2 = 4, H2 = 4;
    const { ctx, state } = makeCtx(W2, H2);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(1, 1));
    tool.onPointerMove(pe(10, 10));
    tool.onPointerUp(pe(10, 10));

    // Should be clamped to canvas
    expect(state.selection!.bounds.x).toBe(1);
    expect(state.selection!.bounds.y).toBe(1);
    expect(state.selection!.bounds.w).toBe(W2 - 1); // 3
    expect(state.selection!.bounds.h).toBe(H2 - 1); // 3
  });

  it('click outside existing selection starts a new selection draw', () => {
    const { ctx, state } = makeCtx(W, H);
    const tool = new MarqueeTool(ctx);

    // Draw first selection at (1,1)–(2,2)
    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(2, 2));

    // Click outside (at 5,5) to draw a new selection
    tool.onPointerDown(pe(5, 5));
    tool.onPointerMove(pe(6, 6));
    tool.onPointerUp(pe(6, 6));

    expect(state.selection!.bounds).toEqual({ x: 5, y: 5, w: 2, h: 2 });
  });
});

describe('MarqueeTool — move mode (floating model)', () => {
  const W = 8, H = 8;

  it('produces no DrawCommand on drop — float stays alive', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(5, 5));

    expect(commands).toHaveLength(0);
    expect(priv(tool)._floating).not.toBeNull();
  });

  it('re-drag accumulates currentDx/Dy without double-counting', () => {
    const buf = makeBuf(W, H, [{ x: 2, y: 2, color: RED }]);
    const { ctx, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 2, y: 2 }]);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(3, 3)); // +1,+1
    expect(priv(tool)._floating.currentDx).toBe(1);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(4, 4)); // +1,+1 more
    expect(priv(tool)._floating.currentDx).toBe(2);
    expect(priv(tool)._floating.currentDy).toBe(2);
  });

  it('onDeactivate commits float as one DrawCommand', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(5, 5));
    tool.onDeactivate();

    expect(commands).toHaveLength(1);
    expect(readPixel(layerBuf, 3, 3, W)).toBe(0);
    expect(readPixel(layerBuf, 5, 5, W)).toBe(RED);
    expect(priv(tool)._floating).toBeNull();
  });

  it('undo after commit restores pixel to original position', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(5, 5));
    tool.onDeactivate();
    commands[0]!.undo();

    expect(readPixel(layerBuf, 3, 3, W)).toBe(RED);
    expect(readPixel(layerBuf, 5, 5, W)).toBe(0);
  });

  it('multi-segment float commits single DrawCommand covering full delta', () => {
    const buf = makeBuf(W, H, [{ x: 1, y: 1, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 1, y: 1 }]);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(2, 2));
    tool.onPointerDown(pe(2, 2));
    tool.onPointerUp(pe(3, 3));

    tool.onDeactivate();

    expect(commands).toHaveLength(1);
    expect(readPixel(layerBuf, 1, 1, W)).toBe(0);
    expect(readPixel(layerBuf, 3, 3, W)).toBe(RED);
  });

  it('off-canvas drop reverts background snapshot — float stays at last valid position', () => {
    const W2 = 4, H2 = 4;
    const buf = makeBuf(W2, H2, [{ x: 1, y: 1, color: RED }]);
    const { ctx, commands, state } = makeCtx(W2, H2, buf);
    state.selection = makeSelMask(W2, H2, [{ x: 1, y: 1 }]);
    const tool = new MarqueeTool(ctx);

    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(20, 20)); // off-canvas

    expect(commands).toHaveLength(0);
    const floating = priv(tool)._floating;
    expect(floating).not.toBeNull();
    expect(floating.currentDx).toBe(0);
    expect(floating.currentDy).toBe(0);
  });

  it('off-canvas revert then valid drop still moves pixel correctly', () => {
    const W2 = 4, H2 = 4;
    const buf = makeBuf(W2, H2, [{ x: 1, y: 1, color: RED }]);
    const { ctx, layerBuf, state } = makeCtx(W2, H2, buf);
    state.selection = makeSelMask(W2, H2, [{ x: 1, y: 1 }]);
    const tool = new MarqueeTool(ctx);

    // First drop: off-canvas
    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(20, 20));

    // Second drop: valid, +1,+1
    tool.onPointerDown(pe(1, 1));
    tool.onPointerUp(pe(2, 2));

    tool.onDeactivate();

    expect(readPixel(layerBuf, 1, 1, W2)).toBe(0);
    expect(readPixel(layerBuf, 2, 2, W2)).toBe(RED);
  });

  it('cancel during move drag reverts segment — float stays alive at prior offset', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MarqueeTool(ctx);

    // First drop succeeds
    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(4, 4));
    expect(priv(tool)._floating.currentDx).toBe(1);

    // Start second drag, cancel mid-way
    tool.onPointerDown(pe(4, 4));
    tool.onPointerMove(pe(6, 6));
    tool.onCancel();

    // Float stays alive at the committed offset (1,1), not at mid-drag (3,3)
    const floating = priv(tool)._floating;
    expect(floating).not.toBeNull();
    expect(floating.currentDx).toBe(1);
    expect(priv(tool).moving).toBe(false);
  });

  it('cancel with no active drag cancels entire float and restores original state', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, commands, state } = makeCtx(W, H, buf);
    const origSel = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    state.selection = origSel;
    const tool = new MarqueeTool(ctx);

    // Complete a drop so float is alive
    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(4, 4));

    // Cancel entire float
    tool.onCancel();

    expect(commands).toHaveLength(0);
    expect(priv(tool)._floating).toBeNull();
    // Selection restored to original
    expect(state.selection).toBe(origSel);
  });

  it('clicking outside selection commits float and starts new selection draw', () => {
    const buf = makeBuf(W, H, [{ x: 3, y: 3, color: RED }]);
    const { ctx, layerBuf, commands, state } = makeCtx(W, H, buf);
    state.selection = makeSelMask(W, H, [{ x: 3, y: 3 }]);
    const tool = new MarqueeTool(ctx);

    // Move the float to (4,4)
    tool.onPointerDown(pe(3, 3));
    tool.onPointerUp(pe(4, 4));

    // Click outside selection (at 0,0) — should commit, then start new draw
    tool.onPointerDown(pe(0, 0));
    tool.onPointerMove(pe(1, 1));
    tool.onPointerUp(pe(1, 1));

    // Float was committed
    expect(commands).toHaveLength(1);
    expect(readPixel(layerBuf, 3, 3, W)).toBe(0);
    expect(readPixel(layerBuf, 4, 4, W)).toBe(RED);

    // New selection was drawn
    expect(state.selection!.bounds).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });
});
