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
 * Moves pixels of the active layer by a drag offset.
 *
 * Non-destructive floating-selection model:
 *   A DrawCommand is NOT committed on every drop. Instead the moved pixels
 *   "float" above a background copy that preserves original ambient pixels at
 *   every destination. Multiple repositionings are allowed before committing.
 *   A single DrawCommand (covering the full delta from original → final
 *   positions) is executed when the tool is deactivated, the selection is
 *   cleared, or onCancel is called with no active drag.
 *
 * Without an active selection all non-transparent pixels are moved and the
 * float is committed immediately on each drop (no meaningful "non-destructive"
 * scenario without a mask).
 */

interface FloatingState {
  /** Pixels lifted from the layer — captured once, reused across re-drags. */
  pixels: Array<{ x: number; y: number; color: RGBA }>;
  /** Mutable layer copy: source positions always zeroed; current destination
   *  positions written in after each drop so the canvas looks correct between
   *  drags without relying on the scratch buffer. Updated via _updateMovePreview
   *  during a drag. */
  background: Uint8ClampedArray;
  /** Frozen snapshot of the layer at float start. Never modified. Used as the
   *  `before` reference for DrawCommand deltas and for restoring original
   *  ambient pixel values in _updateMovePreview. */
  originalLayerBuf: Uint8ClampedArray;
  /** Selection mask active when the float started — restored on cancel. */
  originalSelection: SelectionMask | null;
  layerId: LayerId;
  /** Cumulative displacement of the floating pixels from their original source
   *  positions (accumulates across multiple drag segments). */
  currentDx: number;
  currentDy: number;
}

export class MoveTool implements Tool {
  readonly id: ToolId = 'move';
  readonly cursor: CursorDef = { type: 'move' };

  private active = false;
  private startX = 0;
  private startY = 0;

  private scratch: Uint8ClampedArray | null = null;
  private scratchW = 0;
  private scratchH = 0;

  // Active-drag references (valid only while active === true)
  private layerId: LayerId | null = null;
  private layerBuf: Uint8ClampedArray | null = null;
  private pixels: Array<{ x: number; y: number; color: RGBA }> = [];
  private selBoundsAtStart: { x: number; y: number; w: number; h: number } | null = null;

  // GPU-preview references during drag
  private _previewBuf: Uint8ClampedArray | null = null;
  private _prevMoveDx = 0;
  private _prevMoveDy = 0;

  // Floating selection (persists between drag segments)
  private _floating: FloatingState | null = null;
  /** Snapshot of _floating.background taken at the START of each drag segment.
   *  Used by onCancel to restore the pre-drag background without recomputing. */
  private _backgroundSnapshot: Uint8ClampedArray | null = null;

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    if (this.active) return;
    if (this.ctx.isActiveLayerLocked()) return;
    const layerId = this.ctx.getActiveLayerId();
    if (!layerId) return;
    const layerBuf = this.ctx.getLayerData(layerId);
    if (!layerBuf) return;

    const { width, height } = this.ctx.getCanvasSize();
    this.ensureScratch(width, height);

    const selection = this.ctx.getSelection();

    // ── Re-drag of an existing float ─────────────────────────────────────────
    if (this._floating && this._floating.layerId === layerId) {
      this._backgroundSnapshot = this._floating.background.slice();
      this._prevMoveDx = 0;
      this._prevMoveDy = 0;
      this._previewBuf = this._floating.background;

      this.active = true;
      this.layerId = layerId;
      this.layerBuf = layerBuf;
      this.pixels = this._floating.pixels;
      this.startX = e.canvasX;
      this.startY = e.canvasY;
      this.selBoundsAtStart = selection ? { ...selection.bounds } : null;

      // Upload background (floating pixels already written in at currentDx/Dy)
      this.ctx.previewLayerOnGPU(layerId, this._floating.background);

      // Init scratch: show floating pixels at current offset so they're visible
      // immediately on the first frame before the user moves the pointer.
      this.scratch!.fill(0);
      for (const { x, y, color } of this._floating.pixels) {
        const nx = x + this._floating.currentDx;
        const ny = y + this._floating.currentDy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height)
          writePixel(this.scratch!, nx, ny, width, color);
      }
      this.ctx.updateScratch(this.scratch!);
      return;
    }

    // ── First drag — start a new float ───────────────────────────────────────
    const capturedPixels: Array<{ x: number; y: number; color: RGBA }> = [];

    if (selection) {
      this.selBoundsAtStart = { ...selection.bounds };
      const { bounds } = selection;
      const hasMask = selection.data.length > 1;
      for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (hasMask && !selection.data[y * selection.width + x]) continue;
          const c = readPixel(layerBuf, x, y, width);
          if ((c & 0xff) !== 0) capturedPixels.push({ x, y, color: c });
        }
      }
    } else {
      this.selBoundsAtStart = null;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const c = readPixel(layerBuf, x, y, width);
          if ((c & 0xff) !== 0) capturedPixels.push({ x, y, color: c });
        }
      }
    }

    if (capturedPixels.length === 0) return;

    // Build frozen original + mutable background with source pixels cleared.
    const originalLayerBuf = new Uint8ClampedArray(layerBuf);
    const background = new Uint8ClampedArray(layerBuf);
    for (const { x, y } of capturedPixels) {
      writePixel(background, x, y, width, 0);
    }

    this._floating = {
      pixels: capturedPixels,
      background,
      originalLayerBuf,
      originalSelection: selection,  // null when no selection
      layerId,
      currentDx: 0,
      currentDy: 0,
    };
    this._backgroundSnapshot = background.slice();
    this._prevMoveDx = 0;
    this._prevMoveDy = 0;
    this._previewBuf = background;

    this.active = true;
    this.layerId = layerId;
    this.layerBuf = layerBuf;
    this.pixels = capturedPixels;
    this.startX = e.canvasX;
    this.startY = e.canvasY;

    this.ctx.previewLayerOnGPU(layerId, background);

    // Init scratch at offset 0 so pixels are visible immediately.
    this.scratch!.fill(0);
    for (const { x, y, color } of capturedPixels) {
      if (x >= 0 && y >= 0 && x < width && y < height)
        writePixel(this.scratch!, x, y, width, color);
    }
    this.ctx.updateScratch(this.scratch!);
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (!this.active) return;
    const dx = e.canvasX - this.startX;
    const dy = e.canvasY - this.startY;
    const w = this.scratchW;
    const h = this.scratchH;

    // Update scratch with moved pixels at new position
    this.scratch!.fill(0);
    for (const { x, y, color } of this.pixels) {
      const nx = x + (this._floating?.currentDx ?? 0) + dx;
      const ny = y + (this._floating?.currentDy ?? 0) + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h)
        writePixel(this.scratch!, nx, ny, w, color);
    }
    this.ctx.updateScratch(this.scratch!);

    // GPU preview: keep destination transparent so scratch is the only content there
    if (this._previewBuf && this.layerBuf && this.layerId) {
      this._updateMovePreview(dx, dy);
    }

    if (this.selBoundsAtStart) {
      this.ctx.setSelectionDragOffset({ dx, dy });
    }
  }

  onPointerUp(e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.active = false;

    const segDx = e.canvasX - this.startX;
    const segDy = e.canvasY - this.startY;
    const w = this.scratchW;
    const h = this.scratchH;

    this.ctx.setSelectionDragOffset(null);

    if (!this._floating) {
      // Shouldn't happen, but guard cleanly.
      this.ctx.clearScratch();
      this.layerId = null; this.layerBuf = null; this._previewBuf = null; this.pixels = [];
      return;
    }

    // ── No selection: commit immediately (one undoable DrawCommand per drop) ───
    // Pixels survive going off-canvas during the drag; they're clipped only here.
    if (!this._floating.originalSelection) {
      this._floating.currentDx += segDx;
      this._floating.currentDy += segDy;
      this.layerId = null;
      this.layerBuf = null;
      this.pixels = [];
      this.selBoundsAtStart = null;
      this.commitFloating();
      return;
    }

    // ── With selection: non-destructive drop ─────────────────────────────────
    // Check whether the drop position has at least one in-bounds pixel before
    // modifying background — if all pixels went off-canvas, revert to the
    // pre-drag snapshot so the float stays alive at its last visible position.
    const newDx = this._floating.currentDx + segDx;
    const newDy = this._floating.currentDy + segDy;
    const anyInBounds = this._floating.pixels.some(
      ({ x, y }) => x + newDx >= 0 && y + newDy >= 0 && x + newDx < w && y + newDy < h,
    );

    if (!anyInBounds) {
      if (this._backgroundSnapshot) {
        this._floating.background.set(this._backgroundSnapshot);
      }
      this.ctx.previewLayerOnGPU(this._floating.layerId, this._floating.background);
      this.ctx.clearScratch();
      this._backgroundSnapshot = null;
      this.layerId = null;
      this.layerBuf = null;
      this.pixels = [];
      this.selBoundsAtStart = null;
      return;
    }

    // Final _updateMovePreview before clearing active-drag refs.
    if (this._previewBuf && this.layerBuf && this.layerId) {
      this._updateMovePreview(segDx, segDy);
    }

    // Accumulate offset.
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
    this.ctx.clearScratch();
    this._backgroundSnapshot = null;

    // Rebuild selection at exact new pixel positions
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

    this.layerId = null;
    this.layerBuf = null;
    this.pixels = [];
    this.selBoundsAtStart = null;
  }

  onCancel(): void {
    if (this.active && this._floating) {
      // Cancel current drag segment only — revert background to pre-drag snapshot
      this.active = false;
      if (this._backgroundSnapshot) {
        this._floating.background.set(this._backgroundSnapshot);
        this.ctx.previewLayerOnGPU(this._floating.layerId, this._floating.background);
      }
      this._backgroundSnapshot = null;
      this.layerId = null;
      this.layerBuf = null;
      this.pixels = [];
      this.selBoundsAtStart = null;
      this.ctx.setSelectionDragOffset(null);
      this.ctx.clearScratch();
      return;
    }

    if (!this.active && this._floating) {
      // Cancel entire float — restore original layer state
      const { layerId, originalLayerBuf, originalSelection } = this._floating;
      this.ctx.previewLayerOnGPU(layerId, originalLayerBuf);
      if (originalSelection) this.ctx.setSelection(originalSelection);
      else this.ctx.clearSelection();
      this._floating = null;
      this._backgroundSnapshot = null;
      this.ctx.clearScratch();
      return;
    }

    // No float — clean up active drag if any
    if (this.active && this.layerId && this.layerBuf) {
      this.ctx.previewLayerOnGPU(this.layerId, this.layerBuf);
    }
    this.active = false;
    this.layerId = null;
    this.layerBuf = null;
    this._previewBuf = null;
    this.pixels = [];
    this.selBoundsAtStart = null;
    this.ctx.setSelectionDragOffset(null);
    this.ctx.clearScratch();
  }

  onDeactivate(): void {
    this.commitFloating();
    // Clean up any active non-floating drag
    if (this.active) {
      if (this.layerId && this.layerBuf)
        this.ctx.previewLayerOnGPU(this.layerId, this.layerBuf);
      this.active = false;
      this.layerId = null;
      this.layerBuf = null;
      this._previewBuf = null;
      this.pixels = [];
      this.selBoundsAtStart = null;
      this.ctx.setSelectionDragOffset(null);
      this.ctx.clearScratch();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private commitFloating(): void {
    if (!this._floating) return;
    const { pixels, originalLayerBuf, layerId, currentDx, currentDy } = this._floating;
    const w = this.scratchW;
    const h = this.scratchH;
    const liveBuf = this.ctx.getLayerData(layerId);

    this._floating = null;
    this._backgroundSnapshot = null;
    this.active = false;
    this.layerId = null;
    this.layerBuf = null;
    this._previewBuf = null;
    this.pixels = [];
    this.selBoundsAtStart = null;
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
   * live drag so that source positions stay transparent, the previous
   * destination footprint is restored from original ambient values, and the
   * new destination footprint is zeroed so only scratch content shows there.
   *
   * `orig` is always _floating.originalLayerBuf so that restoring previous
   * destinations always yields the ORIGINAL ambient pixel — not any value that
   * may have been written into background by a previous drag segment.
   */
  private _updateMovePreview(segDx: number, segDy: number): void {
    const buf = this._previewBuf!;
    const orig = this._floating?.originalLayerBuf ?? this.layerBuf!;
    const w = this.scratchW;
    const h = this.scratchH;
    const baseDx = this._floating?.currentDx ?? 0;
    const baseDy = this._floating?.currentDy ?? 0;
    const pdx = this._prevMoveDx;
    const pdy = this._prevMoveDy;

    // 1. Restore previous destination footprint from original data
    for (const { x, y } of this.pixels) {
      const px = x + baseDx + pdx;
      const py = y + baseDy + pdy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      writePixel(buf, px, py, w, readPixel(orig, px, py, w));
    }
    // 2. Re-zero source positions (step 1 may have restored them)
    for (const { x, y } of this.pixels) {
      writePixel(buf, x, y, w, 0);
    }
    // 3. Zero new destination footprint
    for (const { x, y } of this.pixels) {
      const nx = x + baseDx + segDx;
      const ny = y + baseDy + segDy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      writePixel(buf, nx, ny, w, 0);
    }

    this._prevMoveDx = segDx;
    this._prevMoveDy = segDy;
    this.ctx.previewLayerOnGPU(this.layerId!, buf);
  }

  private ensureScratch(w: number, h: number): void {
    if (!this.scratch || this.scratchW !== w || this.scratchH !== h) {
      this.scratch = new Uint8ClampedArray(w * h * 4);
      this.scratchW = w;
      this.scratchH = h;
    }
  }
}
