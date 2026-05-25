import type { LayerId, RGBA } from '../DataModel';
import { readPixel, writePixel } from '../DataModel';
import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';
import type { SelectionMask } from '../ToolEngine/types';
import { DrawCommand, type PixelDelta } from '../commands/DrawCommand';

/**
 * Rectangular marquee selection.
 *
 * Selection behaviour:
 *   • Click + drag on empty canvas → draw a new rectangular selection.
 *   • Click + drag INSIDE committed selection → move the selected pixels live.
 *     The selection overlay and pixels both follow the pointer in real time.
 *   • Double-click on canvas → clear selection (also handled in CanvasViewport).
 *   • Ctrl+I → invert selection (handled in CanvasViewport keyboard handler).
 *
 * Non-destructive floating-selection model (move mode):
 *   Moved pixels float above a background copy that preserves original ambient
 *   pixels at every destination. Multiple repositionings are allowed before a
 *   single DrawCommand commits the full delta from original → final positions.
 *   Commit triggers on tool switch, deselect, delete/cut/selectAll, or Escape
 *   with no active drag.
 */

interface FloatingState {
  pixels: Array<{ x: number; y: number; color: RGBA }>;
  background: Uint8ClampedArray;
  originalLayerBuf: Uint8ClampedArray;
  originalSelection: SelectionMask | null;
  layerId: LayerId;
  currentDx: number;
  currentDy: number;
}

export class MarqueeTool implements Tool {
  readonly id: ToolId = 'marquee';
  readonly cursor: CursorDef = { type: 'crosshair' };

  // ── selection-draw state ───────────────────────────────────────────────────
  private selecting = false;
  private pendingNewSelection = false;
  private selStartX = 0;
  private selStartY = 0;

  // ── move state ────────────────────────────────────────────────────────────
  private moving = false;
  private moveStartX = 0;
  private moveStartY = 0;
  private moveLayerId: LayerId | null = null;
  // Points to _floating.background during a drag segment.
  private _previewBuf: Uint8ClampedArray | null = null;
  private _prevMoveDx = 0;
  private _prevMoveDy = 0;
  // Points to _floating.pixels during a drag segment.
  private movePixels: Array<{ x: number; y: number; color: RGBA }> = [];
  private moveScratch: Uint8ClampedArray | null = null;
  private moveScratchW = 0;
  private moveScratchH = 0;
  private _prevScratchPixels: Array<{ x: number; y: number }> = [];

  // ── floating selection (persists between drag segments) ───────────────────
  private _floating: FloatingState | null = null;
  private _backgroundSnapshot: Uint8ClampedArray | null = null;

  // Minimal placeholder used during live selection drag to avoid per-frame allocs.
  private static readonly DRAFT_MASK = new Uint8ClampedArray(1);

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    if (this.moving) return;

    const sel = this.ctx.getSelection();

    const insideSel =
      sel &&
      sel.data.length > 1 &&
      e.canvasX >= sel.bounds.x && e.canvasX < sel.bounds.x + sel.bounds.w &&
      e.canvasY >= sel.bounds.y && e.canvasY < sel.bounds.y + sel.bounds.h &&
      sel.data[e.canvasY * sel.width + e.canvasX] === 1;

    if (insideSel && sel) {
      if (this.ctx.isActiveLayerLocked()) return;
      const layerId = this.ctx.getActiveLayerId();
      if (!layerId) return;
      const layerBuf = this.ctx.getLayerData(layerId);
      if (!layerBuf) return;

      const { width, height } = this.ctx.getCanvasSize();
      this.ensureMoveScratch(width, height);

      // ── Re-drag of an existing float ───────────────────────────────────────
      if (this._floating && this._floating.layerId === layerId) {
        this._backgroundSnapshot = this._floating.background.slice();
        this._prevMoveDx = 0;
        this._prevMoveDy = 0;
        this._previewBuf = this._floating.background;

        this.moving = true;
        this.moveStartX = e.canvasX;
        this.moveStartY = e.canvasY;
        this.moveLayerId = layerId;
        this.movePixels = this._floating.pixels;

        this.ctx.previewLayerOnGPU(layerId, this._floating.background);

        this.moveScratch!.fill(0);
        this._prevScratchPixels = [];
        for (const { x, y, color } of this._floating.pixels) {
          const nx = x + this._floating.currentDx;
          const ny = y + this._floating.currentDy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            writePixel(this.moveScratch!, nx, ny, width, color);
            this._prevScratchPixels.push({ x: nx, y: ny });
          }
        }
        this.ctx.updateScratch(this.moveScratch!);
        return;
      }

      // ── First drag — start a new float ─────────────────────────────────────
      const capturedPixels: Array<{ x: number; y: number; color: RGBA }> = [];
      const { bounds } = sel;
      for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (!sel.data[y * sel.width + x]) continue;
          const c = readPixel(layerBuf, x, y, width);
          if ((c & 0xff) !== 0) capturedPixels.push({ x, y, color: c });
        }
      }

      if (capturedPixels.length === 0) return;

      const originalLayerBuf = new Uint8ClampedArray(layerBuf);
      const background = new Uint8ClampedArray(layerBuf);
      for (const { x, y } of capturedPixels) {
        writePixel(background, x, y, width, 0);
      }

      this._floating = {
        pixels: capturedPixels,
        background,
        originalLayerBuf,
        originalSelection: sel,
        layerId,
        currentDx: 0,
        currentDy: 0,
      };
      this._backgroundSnapshot = background.slice();
      this._prevMoveDx = 0;
      this._prevMoveDy = 0;
      this._previewBuf = background;

      this.moving = true;
      this.moveStartX = e.canvasX;
      this.moveStartY = e.canvasY;
      this.moveLayerId = layerId;
      this.movePixels = capturedPixels;

      this.ctx.previewLayerOnGPU(layerId, background);

      this.moveScratch!.fill(0);
      this._prevScratchPixels = [];
      for (const { x, y, color } of capturedPixels) {
        if (x >= 0 && y >= 0 && x < width && y < height) {
          writePixel(this.moveScratch!, x, y, width, color);
          this._prevScratchPixels.push({ x, y });
        }
      }
      this.ctx.updateScratch(this.moveScratch!);
      return;
    }

    // Commit any active float before starting a new selection draw.
    this.commitFloating();

    this.selStartX = e.canvasX;
    this.selStartY = e.canvasY;
    if (sel && sel.data.length > 1) {
      this.pendingNewSelection = true;
    } else {
      this.selecting = true;
    }
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (this.moving) {
      const dx = e.canvasX - this.moveStartX;
      const dy = e.canvasY - this.moveStartY;
      const baseDx = this._floating?.currentDx ?? 0;
      const baseDy = this._floating?.currentDy ?? 0;
      const w = this.moveScratchW;
      const h = this.moveScratchH;

      // Clear only pixels written in the previous move event.
      for (const { x, y } of this._prevScratchPixels) {
        const i = (y * w + x) * 4;
        this.moveScratch![i] = this.moveScratch![i + 1] = this.moveScratch![i + 2] = this.moveScratch![i + 3] = 0;
      }
      this._prevScratchPixels = [];
      for (const { x, y, color } of this.movePixels) {
        const nx = x + baseDx + dx;
        const ny = y + baseDy + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
          writePixel(this.moveScratch!, nx, ny, w, color);
          this._prevScratchPixels.push({ x: nx, y: ny });
        }
      }
      this.ctx.updateScratch(this.moveScratch!);

      if (this._previewBuf && this.moveLayerId && this._floating) {
        this._updateMovePreview(dx, dy);
      }

      this.ctx.setSelectionDragOffset({ dx, dy });
      return;
    }

    if (this.pendingNewSelection) {
      this.pendingNewSelection = false;
      this.selecting = true;
      this.ctx.clearSelection();
    }

    if (!this.selecting) return;
    const [x1, y1] = this.constrain(e.canvasX, e.canvasY, e.shiftKey);
    const { width, height } = this.ctx.getCanvasSize();

    const minX = Math.max(0, Math.min(this.selStartX, x1));
    const maxX = Math.min(width - 1, Math.max(this.selStartX, x1));
    const minY = Math.max(0, Math.min(this.selStartY, y1));
    const maxY = Math.min(height - 1, Math.max(this.selStartY, y1));
    if (maxX < minX || maxY < minY) return;

    this.ctx.setSelection({
      data: MarqueeTool.DRAFT_MASK,
      width: 1,
      height: 1,
      bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    });
  }

  onPointerUp(e: CanvasPointerEvent): void {
    if (this.pendingNewSelection) {
      this.pendingNewSelection = false;
      return;
    }

    if (this.moving) {
      const segDx = e.canvasX - this.moveStartX;
      const segDy = e.canvasY - this.moveStartY;
      const w = this.moveScratchW;
      const h = this.moveScratchH;

      this.moving = false;
      const layerId = this.moveLayerId;
      this.ctx.clearScratch();
      this.ctx.setSelectionDragOffset(null);
      this._prevScratchPixels = [];

      if (!layerId || !this._floating) {
        this.moveLayerId = null;
        this._previewBuf = null;
        this.movePixels = [];
        return;
      }

      // Check whether the drop position has at least one in-bounds pixel.
      const newDx = this._floating.currentDx + segDx;
      const newDy = this._floating.currentDy + segDy;
      const anyInBounds = this._floating.pixels.some(
        ({ x, y }) => x + newDx >= 0 && y + newDy >= 0 && x + newDx < w && y + newDy < h,
      );

      if (!anyInBounds) {
        // All pixels went off-canvas. Revert background to the pre-drag snapshot
        // so the float stays alive at its last visible position.
        if (this._backgroundSnapshot) {
          this._floating.background.set(this._backgroundSnapshot);
        }
        this.ctx.previewLayerOnGPU(layerId, this._floating.background);
        this.moveLayerId = null;
        this._previewBuf = null;
        this._backgroundSnapshot = null;
        this.movePixels = [];
        return;
      }

      // Final preview update while moveLayerId is still set.
      if (this._previewBuf) {
        this._updateMovePreview(segDx, segDy);
      }
      this.moveLayerId = null;
      this._previewBuf = null;

      // Accumulate displacement.
      this._floating.currentDx = newDx;
      this._floating.currentDy = newDy;

      // Write floating pixels into background at new position.
      for (const { x, y, color } of this._floating.pixels) {
        const nx = x + this._floating.currentDx;
        const ny = y + this._floating.currentDy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        writePixel(this._floating.background, nx, ny, w, color);
      }

      this.ctx.previewLayerOnGPU(this._floating.layerId, this._floating.background);
      this._backgroundSnapshot = null;

      // Rebuild selection at exact new pixel positions.
      const { currentDx, currentDy } = this._floating;
      const newMask = new Uint8ClampedArray(w * h);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const { x, y } of this._floating.pixels) {
        const fx = x + currentDx; const fy = y + currentDy;
        if (fx < 0 || fy < 0 || fx >= w || fy >= h) continue;
        newMask[fy * w + fx] = 1;
        if (fx < minX) minX = fx; if (fx > maxX) maxX = fx;
        if (fy < minY) minY = fy; if (fy > maxY) maxY = fy;
      }
      if (maxX >= 0) {
        this.ctx.setSelection({
          data: newMask, width: w, height: h,
          bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        });
      }

      this.movePixels = [];
      return;
    }

    if (!this.selecting) return;
    this.selecting = false;

    const [x1, y1] = this.constrain(e.canvasX, e.canvasY, e.shiftKey);
    const { width, height } = this.ctx.getCanvasSize();

    const minX = Math.max(0, Math.min(this.selStartX, x1));
    const maxX = Math.min(width - 1, Math.max(this.selStartX, x1));
    const minY = Math.max(0, Math.min(this.selStartY, y1));
    const maxY = Math.min(height - 1, Math.max(this.selStartY, y1));

    if (maxX < minX || maxY < minY) {
      this.ctx.clearSelection();
      return;
    }

    const mask = new Uint8ClampedArray(width * height);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        mask[y * width + x] = 1;

    this.ctx.setSelection({
      data: mask,
      width,
      height,
      bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    });
  }

  onCancel(): void {
    if (this.moving && this._floating) {
      // Cancel current drag segment; revert background to pre-drag snapshot.
      this.moving = false;
      if (this._backgroundSnapshot) {
        this._floating.background.set(this._backgroundSnapshot);
        this.ctx.previewLayerOnGPU(this._floating.layerId, this._floating.background);
      }
      this._backgroundSnapshot = null;
      this.moveLayerId = null;
      this._previewBuf = null;
      this.movePixels = [];
      this._prevScratchPixels = [];
      this.ctx.setSelectionDragOffset(null);
      this.ctx.clearScratch();
      return;
    }

    if (!this.moving && this._floating) {
      // Cancel entire float; restore original layer state and selection.
      const { layerId, originalLayerBuf, originalSelection } = this._floating;
      this.ctx.previewLayerOnGPU(layerId, originalLayerBuf);
      if (originalSelection) this.ctx.setSelection(originalSelection);
      else this.ctx.clearSelection();
      this._floating = null;
      this._backgroundSnapshot = null;
      this.selecting = false;
      this.pendingNewSelection = false;
      this.ctx.clearScratch();
      return;
    }

    // No float — clean up any active state.
    this.selecting = false;
    this.pendingNewSelection = false;
    this.moving = false;
    this.moveLayerId = null;
    this._previewBuf = null;
    this.movePixels = [];
    this._prevScratchPixels = [];
    this.ctx.setSelectionDragOffset(null);
    this.ctx.clearScratch();
    this.ctx.clearSelection();
  }

  onDeactivate(): void {
    this.commitFloating();
    if (this.moving) this.onCancel();
  }

  private commitFloating(): void {
    if (!this._floating) return;
    const { pixels, originalLayerBuf, layerId, currentDx, currentDy } = this._floating;
    const w = this.moveScratchW;
    const h = this.moveScratchH;
    const liveBuf = this.ctx.getLayerData(layerId);

    this._floating = null;
    this._backgroundSnapshot = null;
    this.moving = false;
    this.moveLayerId = null;
    this._previewBuf = null;
    this.movePixels = [];
    this._prevScratchPixels = [];
    this.ctx.setSelectionDragOffset(null);
    this.ctx.clearScratch();

    if (!liveBuf) return;

    const deltaMap = new Map<number, PixelDelta>();
    for (const { x, y } of pixels) {
      const key = y * w + x;
      if (!deltaMap.has(key))
        deltaMap.set(key, { x, y, before: readPixel(originalLayerBuf, x, y, w), after: 0 });
    }
    for (const { x, y, color } of pixels) {
      const nx = x + currentDx; const ny = y + currentDy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const key = ny * w + nx;
      const existing = deltaMap.get(key);
      if (existing) existing.after = color;
      else deltaMap.set(key, { x: nx, y: ny, before: readPixel(originalLayerBuf, nx, ny, w), after: color });
    }

    if (deltaMap.size === 0) {
      this.ctx.previewLayerOnGPU(layerId, liveBuf);
      return;
    }
    const cmd = new DrawCommand(
      layerId, Array.from(deltaMap.values()), liveBuf, w,
      (id, data) => this.ctx.notifyLayerChanged(id, data),
      'Move selection',
    );
    this.ctx.executeCommand(cmd);
  }

  /**
   * Incrementally keeps _previewBuf (_floating.background) correct during a
   * live drag. `orig` is always _floating.originalLayerBuf so that restoring
   * previous destinations always yields the ORIGINAL ambient pixel values
   * regardless of how many drag segments have occurred.
   */
  private _updateMovePreview(dx: number, dy: number): void {
    const buf = this._previewBuf!;
    const orig = this._floating?.originalLayerBuf ?? buf;
    const baseDx = this._floating?.currentDx ?? 0;
    const baseDy = this._floating?.currentDy ?? 0;
    const w = this.moveScratchW;
    const h = this.moveScratchH;
    const pdx = this._prevMoveDx;
    const pdy = this._prevMoveDy;

    // 1. Restore previous destination footprint from original data.
    for (const { x, y } of this.movePixels) {
      const px = x + baseDx + pdx;
      const py = y + baseDy + pdy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      writePixel(buf, px, py, w, readPixel(orig, px, py, w));
    }
    // 2. Re-zero source positions (step 1 may have restored them if prev dest overlapped source).
    for (const { x, y } of this.movePixels) {
      writePixel(buf, x, y, w, 0);
    }
    // 3. Zero new destination footprint so scratch pixels are the only content there.
    for (const { x, y } of this.movePixels) {
      const nx = x + baseDx + dx;
      const ny = y + baseDy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      writePixel(buf, nx, ny, w, 0);
    }

    this._prevMoveDx = dx;
    this._prevMoveDy = dy;
    this.ctx.previewLayerOnGPU(this.moveLayerId!, buf);
  }

  private constrain(x: number, y: number, shift: boolean): [number, number] {
    if (!shift) return [x, y];
    const dx = x - this.selStartX;
    const dy = y - this.selStartY;
    const s = Math.min(Math.abs(dx), Math.abs(dy));
    return [this.selStartX + Math.sign(dx) * s, this.selStartY + Math.sign(dy) * s];
  }

  private ensureMoveScratch(w: number, h: number): void {
    if (!this.moveScratch || this.moveScratchW !== w || this.moveScratchH !== h) {
      this.moveScratch = new Uint8ClampedArray(w * h * 4);
      this.moveScratchW = w;
      this.moveScratchH = h;
    }
  }
}
