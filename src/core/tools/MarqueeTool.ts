import type { LayerId, RGBA } from '../DataModel';
import { readPixel, writePixel } from '../DataModel';
import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';
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
 * Move-preview technique:
 *   At drag start the original selection pixels are cleared in a GPU-only copy
 *   of the layer (via previewLayerOnGPU) so they visually "lift off" immediately.
 *   The scratch buffer then draws them at the new position each frame. On
 *   pointer-up a DrawCommand commits the final state and the real layer data is
 *   restored by notifyLayerChanged — the preview copy is discarded automatically.
 *
 * Fill / erase:
 *   Handled externally via CanvasViewport keyboard shortcuts (Delete → erase,
 *   Alt+Backspace → fill with primary colour). Those shortcuts call the
 *   fillSelection / eraseSelection helpers in action-composers/drawActions.ts.
 */
export class MarqueeTool implements Tool {
  readonly id: ToolId = 'marquee';
  readonly cursor: CursorDef = { type: 'crosshair' };

  // ── selection-draw state ───────────────────────────────────────────────────
  private selecting = false;
  // True after a single click outside a committed selection — waits to see if
  // the user drags (becomes a new selection) or releases (no-op, keeps existing).
  private pendingNewSelection = false;
  private selStartX = 0;
  private selStartY = 0;

  // ── move state ────────────────────────────────────────────────────────────
  private moving = false;
  private moveStartX = 0;
  private moveStartY = 0;
  private moveLayerId: LayerId | null = null;
  private moveLayerBuf: Uint8ClampedArray | null = null;  // original layer data (unmodified)
  // Mutable GPU-preview copy: source pixels zeroed + current destination area zeroed.
  // Updated incrementally each pointer-move so only the floated pixels are visible
  // inside the moving marching ants (ambient destination pixels stay invisible).
  private _previewBuf: Uint8ClampedArray | null = null;
  private _prevMoveDx = 0;
  private _prevMoveDy = 0;
  private movePixels: Array<{ x: number; y: number; color: RGBA }> = [];
  // Tight bounding box of the non-transparent source pixels (not the full selection
  // rectangle). Used so the live marching-ants bounds track only the moved pixels.
  private _pixelBounds: { x: number; y: number; w: number; h: number } | null = null;
  private selBoundsAtMoveStart: { x: number; y: number; w: number; h: number } | null = null;
  private moveScratch: Uint8ClampedArray | null = null;
  private moveScratchW = 0;
  private moveScratchH = 0;
  // Tracks which scratch pixels were written last move event so only those are
  // cleared next event, avoiding a full fill(0) over the whole canvas buffer.
  private _prevScratchPixels: Array<{ x: number; y: number }> = [];

  // Minimal placeholder used during live selection drag to avoid per-frame allocs.
  private static readonly DRAFT_MASK = new Uint8ClampedArray(1);

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;

    const sel = this.ctx.getSelection();

    // Inside a committed selection → enter move mode
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
      this.moveScratch!.fill(0);
      this._prevScratchPixels = [];

      this.moving = true;
      this.moveStartX = e.canvasX;
      this.moveStartY = e.canvasY;
      this.moveLayerId = layerId;
      this.moveLayerBuf = layerBuf;  // reference to store data — NOT modified
      this.selBoundsAtMoveStart = { ...sel.bounds };

      // Snapshot only the non-transparent pixels inside the selection mask.
      // Tracking the EXACT pixels (not the whole rectangle) means the selection
      // after the move only covers those pixels — no ambient canvas pixels bleed in.
      const { bounds } = sel;
      let pxMin = Infinity, pyMin = Infinity, pxMax = -Infinity, pyMax = -Infinity;
      for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (!sel.data[y * sel.width + x]) continue;
          const c = readPixel(layerBuf, x, y, width);
          if ((c & 0xff) !== 0) {
            this.movePixels.push({ x, y, color: c });
            if (x < pxMin) pxMin = x;
            if (x > pxMax) pxMax = x;
            if (y < pyMin) pyMin = y;
            if (y > pyMax) pyMax = y;
          }
        }
      }
      this._pixelBounds = this.movePixels.length > 0
        ? { x: pxMin, y: pyMin, w: pxMax - pxMin + 1, h: pyMax - pyMin + 1 }
        : null;

      // Build a mutable GPU-preview copy with source pixels cleared so they
      // visually "lift off".  _previewBuf is updated incrementally on every
      // pointer-move to also zero the destination area, preventing ambient pixels
      // at the destination from appearing inside the moving marching ants.
      const previewBuf = new Uint8ClampedArray(layerBuf);
      for (const { x, y } of this.movePixels) {
        writePixel(previewBuf, x, y, width, 0);
      }
      this._previewBuf = previewBuf;
      this._prevMoveDx = 0;
      this._prevMoveDy = 0;
      this.ctx.previewLayerOnGPU(layerId, previewBuf);
      return;
    }

    // If a committed selection exists, wait until the user actually drags before
    // starting a new selection.  A bare click (no drag) is a no-op so the user
    // doesn't accidentally dismiss the selection — double-click clears it.
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
      const w = this.moveScratchW;
      const h = this.moveScratchH;

      // ── scratch buffer: paint moved pixels at new position ─────────────────
      // Only clear pixels written in the previous move event, not the full buffer.
      for (const { x, y } of this._prevScratchPixels) {
        const i = (y * w + x) * 4;
        this.moveScratch![i] = this.moveScratch![i + 1] = this.moveScratch![i + 2] = this.moveScratch![i + 3] = 0;
      }
      this._prevScratchPixels = [];
      for (const { x, y, color } of this.movePixels) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
          writePixel(this.moveScratch!, nx, ny, w, color);
          this._prevScratchPixels.push({ x: nx, y: ny });
        }
      }
      this.ctx.updateScratch(this.moveScratch!);

      // ── GPU preview layer: keep destination area transparent ───────────────
      // Incrementally update _previewBuf so only floated pixels are visible
      // inside the moving marching ants — ambient pixels at the destination
      // must not show through.
      if (this._previewBuf && this.moveLayerBuf && this.moveLayerId && this.selBoundsAtMoveStart) {
        this._updateMovePreview(dx, dy);
      }

      // ── selection overlay: follow only the moved pixels, not the full rect ──
      if (this._pixelBounds) {
        const sel = this.ctx.getSelection();
        if (sel) {
          this.ctx.setSelection({
            ...sel,
            bounds: {
              x: this._pixelBounds.x + dx,
              y: this._pixelBounds.y + dy,
              w: this._pixelBounds.w,
              h: this._pixelBounds.h,
            },
          });
        }
      }
      return;
    }

    if (this.pendingNewSelection) {
      // First actual movement after clicking outside a committed selection —
      // promote to an active new-selection drag and clear the old selection.
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
    // Single click outside a committed selection → keep existing selection.
    if (this.pendingNewSelection) {
      this.pendingNewSelection = false;
      return;
    }

    if (this.moving) {
      this.moving = false;
      const layerId = this.moveLayerId;
      const layerBuf = this.moveLayerBuf;
      this.moveLayerId = null;
      this.moveLayerBuf = null;
      this._previewBuf = null;
      this.ctx.clearScratch();

      const dx = e.canvasX - this.moveStartX;
      const dy = e.canvasY - this.moveStartY;

      if (!layerId || !layerBuf) {
        this.movePixels = [];
        this.selBoundsAtMoveStart = null;
        this._pixelBounds = null;
        return;
      }

      const w = this.moveScratchW;
      const h = this.moveScratchH;

      if (this.movePixels.length === 0) {
        // Nothing to move — restore original GPU state
        this.ctx.previewLayerOnGPU(layerId, layerBuf);
        this.selBoundsAtMoveStart = null;
        this._pixelBounds = null;
        return;
      }

      // Build delta map: erase original positions, paint at new positions
      const deltaMap = new Map<number, PixelDelta>();

      for (const { x, y } of this.movePixels) {
        const key = y * w + x;
        if (!deltaMap.has(key))
          deltaMap.set(key, { x, y, before: readPixel(layerBuf, x, y, w), after: 0 });
      }
      for (const { x, y, color } of this.movePixels) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const key = ny * w + nx;
        const existing = deltaMap.get(key);
        if (existing) {
          existing.after = color;
        } else {
          deltaMap.set(key, { x: nx, y: ny, before: readPixel(layerBuf, nx, ny, w), after: color });
        }
      }

      // Rebuild selection from the exact moved-pixel positions (not the full rect).
      // This ensures the next move only picks up the originally-selected pixels,
      // not any ambient canvas pixels that happen to be inside the rectangle.
      {
        const newMask = new Uint8ClampedArray(w * h);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const { x, y } of this.movePixels) {
          const fx = x + dx;
          const fy = y + dy;
          if (fx < 0 || fy < 0 || fx >= w || fy >= h) continue;
          newMask[fy * w + fx] = 1;
          if (fx < minX) minX = fx;
          if (fx > maxX) maxX = fx;
          if (fy < minY) minY = fy;
          if (fy > maxY) maxY = fy;
        }
        if (maxX >= 0) {
          this.ctx.setSelection({
            data: newMask, width: w, height: h,
            bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
          });
        }
      }

      this.movePixels = [];
      this.selBoundsAtMoveStart = null;
      this._pixelBounds = null;

      if (deltaMap.size === 0) {
        // No pixels changed (e.g. zero movement) — restore GPU state
        this.ctx.previewLayerOnGPU(layerId, layerBuf);
        return;
      }

      // notifyLayerChanged inside DrawCommand.execute restores the real layer GPU state
      const cmd = new DrawCommand(
        layerId, Array.from(deltaMap.values()), layerBuf, w,
        (id, data) => this.ctx.notifyLayerChanged(id, data),
        'Move selection',
      );
      this.ctx.executeCommand(cmd);
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

    // Build real per-pixel mask on drag complete
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
    if (this.moving && this.moveLayerId && this.moveLayerBuf) {
      // Restore GPU state to original layer data
      this.ctx.previewLayerOnGPU(this.moveLayerId, this.moveLayerBuf);
    }
    this.selecting = false;
    this.pendingNewSelection = false;
    this.moving = false;
    this.moveLayerId = null;
    this.moveLayerBuf = null;
    this._previewBuf = null;
    this.movePixels = [];
    this.selBoundsAtMoveStart = null;
    this._pixelBounds = null;
    this._prevScratchPixels = [];
    this.ctx.clearScratch();
    this.ctx.clearSelection();
  }

  private constrain(x: number, y: number, shift: boolean): [number, number] {
    if (!shift) return [x, y];
    const dx = x - this.selStartX;
    const dy = y - this.selStartY;
    const s = Math.min(Math.abs(dx), Math.abs(dy));
    return [this.selStartX + Math.sign(dx) * s, this.selStartY + Math.sign(dy) * s];
  }

  /**
   * Incrementally keep _previewBuf correct during a live move drag so that:
   *   - Source pixel positions are always transparent ("lifted off").
   *   - Exactly the positions where moved pixels will land are transparent
   *     (the scratch will paint the moved colours there instead).
   *   - Every other canvas pixel remains at its original value — it is never
   *     hidden just because the selection rectangle happens to pass over it.
   *
   * Previous implementations zeroed the whole bounding-box rectangle, which
   * caused ambient pixels to disappear and reappear as the selection moved,
   * giving the false impression that those pixels were being "captured."
   * Operating only on the exact pixel footprint (movePixels) prevents that.
   */
  private _updateMovePreview(dx: number, dy: number): void {
    const buf = this._previewBuf!;
    const orig = this.moveLayerBuf!;
    const w = this.moveScratchW;
    const h = this.moveScratchH;
    const pdx = this._prevMoveDx;
    const pdy = this._prevMoveDy;

    // 1. Restore the PREVIOUS destination footprint from the frozen original data.
    //    These positions are no longer covered by moved pixels so ambient content
    //    should be visible again.
    for (const { x, y } of this.movePixels) {
      const px = x + pdx;
      const py = y + pdy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      writePixel(buf, px, py, w, readPixel(orig, px, py, w));
    }
    // 2. Re-zero source pixel positions — step 1 may have restored them if the
    //    previous destination happened to overlap the source.
    for (const { x, y } of this.movePixels) {
      writePixel(buf, x, y, w, 0);
    }
    // 3. Zero the NEW destination footprint so the scratch pixels are the only
    //    thing visible at those positions (no ambient colour bleeding through).
    for (const { x, y } of this.movePixels) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      writePixel(buf, nx, ny, w, 0);
    }

    this._prevMoveDx = dx;
    this._prevMoveDy = dy;
    this.ctx.previewLayerOnGPU(this.moveLayerId!, buf);
  }

  private ensureMoveScratch(w: number, h: number): void {
    if (!this.moveScratch || this.moveScratchW !== w || this.moveScratchH !== h) {
      this.moveScratch = new Uint8ClampedArray(w * h * 4);
      this.moveScratchW = w;
      this.moveScratchH = h;
    }
  }
}
