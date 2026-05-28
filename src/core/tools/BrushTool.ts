import type { LayerId, RGBA, BrushShape } from '../DataModel';
import { readPixel, writePixel } from '../DataModel';
import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';
import { DrawCommand, type PixelDelta } from '../commands/DrawCommand';
import { isInSelection } from '../ToolEngine/types';

/**
 * Shared base for hard-edged 1px brush-style tools (pencil, eraser).
 * Manages a CPU scratch buffer, per-pixel delta dedup, Bresenham line plotting,
 * and DrawCommand commit on pointerUp. Subclasses just supply their paint color.
 */
export abstract class BrushTool implements Tool {
  abstract readonly id: ToolId;
  abstract readonly cursor: CursorDef;

  private painting = false;
  private lastX = 0;
  private lastY = 0;

  private scratch: Uint8ClampedArray | null = null;
  private scratchW = 0;
  private scratchH = 0;

  private layerId: LayerId | null = null;
  private layerBuf: Uint8ClampedArray | null = null;
  private deltas = new Map<number, PixelDelta>();
  private color: RGBA = 0;

  // Brush footprint offsets — computed once per stroke from size + shape.
  private offsets: Array<{ dx: number; dy: number }> = [{ dx: 0, dy: 0 }];

  // Pixel-perfect: tracks the last 3 main-path positions to detect L-shaped elbows.
  private _ppHistory: { x: number; y: number }[] = [];

  protected constructor(protected readonly ctx: ToolEngineContext) {}

  /** Called per-stroke to determine the paint color (e.g. primary or transparent). */
  protected abstract resolvePaintColor(): RGBA;

  /**
   * Color written into the scratch preview texture. Defaults to the same as
   * resolvePaintColor(). EraserTool overrides this to an opaque marker so that
   * the scratch DST_OUT pass has pixels to cut through.
   */
  protected scratchColor(): RGBA {
    return this.color;
  }

  /** Description shown in the history panel for this command. */
  protected abstract describe(deltaCount: number): string;

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    if (this.ctx.isActiveLayerLocked()) return;
    const layerId = this.ctx.getActiveLayerId();
    if (!layerId) return;
    const layerBuf = this.ctx.getLayerData(layerId);
    if (!layerBuf) return;

    const { width, height } = this.ctx.getCanvasSize();
    if (e.canvasX < 0 || e.canvasY < 0 || e.canvasX >= width || e.canvasY >= height) return;

    this.ensureScratch(width, height);
    this.scratch!.fill(0);

    this.painting = true;
    this.layerId = layerId;
    this.layerBuf = layerBuf;
    this.color = this.resolvePaintColor();
    this.deltas.clear();
    this._ppHistory.length = 0;

    const { size, shape } = this.ctx.getBrushOptions();
    this.offsets = this.computeOffsets(size, shape);

    this.paintFootprint(e.canvasX, e.canvasY);
    this.lastX = e.canvasX;
    this.lastY = e.canvasY;
    this.ctx.updateScratch(this.scratch!);
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (!this.painting) return;
    if (e.canvasX === this.lastX && e.canvasY === this.lastY) return;
    this.plotLine(this.lastX, this.lastY, e.canvasX, e.canvasY);
    this.lastX = e.canvasX;
    this.lastY = e.canvasY;
    this.ctx.updateScratch(this.scratch!);
  }

  /** Returns the brush footprint offsets for a given size and shape.
   *  Uses asymmetric halves so even sizes paint exactly NxN pixels. */
  computeOffsets(size: number, shape: BrushShape): Array<{ dx: number; dy: number }> {
    if (size <= 1) return [{ dx: 0, dy: 0 }];
    const lo = -Math.floor((size - 1) / 2);
    const hi = Math.floor(size / 2);
    const offsets: Array<{ dx: number; dy: number }> = [];
    for (let dy = lo; dy <= hi; dy++) {
      for (let dx = lo; dx <= hi; dx++) {
        if (shape === 'square' || dx * dx + dy * dy <= hi * hi) {
          offsets.push({ dx, dy });
        }
      }
    }
    return offsets.length > 0 ? offsets : [{ dx: 0, dy: 0 }];
  }

  onPointerUp(_e: CanvasPointerEvent): void {
    if (!this.painting) return;
    this.painting = false;

    const layerId = this.layerId;
    const layerBuf = this.layerBuf;
    this.layerId = null;
    this.layerBuf = null;

    if (!layerId || !layerBuf || this.deltas.size === 0) {
      this.ctx.clearScratch();
      this.deltas.clear();
      return;
    }

    const deltas = Array.from(this.deltas.values());
    this.deltas.clear();

    const { width } = this.ctx.getCanvasSize();
    const cmd = new DrawCommand(
      layerId,
      deltas,
      layerBuf,
      width,
      (id, data) => this.ctx.notifyLayerChanged(id, data),
      this.describe(deltas.length),
    );
    this.ctx.executeCommand(cmd);
    this.ctx.clearScratch();
  }

  onCancel(): void {
    this.painting = false;
    this.layerId = null;
    this.layerBuf = null;
    this.deltas.clear();
    this._ppHistory.length = 0;
    this.ctx.clearScratch();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private ensureScratch(width: number, height: number): void {
    if (!this.scratch || this.scratchW !== width || this.scratchH !== height) {
      this.scratch = new Uint8ClampedArray(width * height * 4);
      this.scratchW = width;
      this.scratchH = height;
    }
  }

  private paintFootprint(cx: number, cy: number): void {
    for (const { dx, dy } of this.offsets) {
      this.paintPixel(cx + dx, cy + dy);
    }
  }

  private paintPixel(x: number, y: number): void {
    const w = this.scratchW;
    const h = this.scratchH;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (!this.scratch || !this.layerBuf) return;
    if (!isInSelection(this.ctx.getSelection(), x, y)) return;

    const key = y * w + x;
    if (!this.deltas.has(key)) {
      const before = readPixel(this.layerBuf, x, y, w);
      this.deltas.set(key, { x, y, before, after: this.color });
    }
    writePixel(this.scratch, x, y, w, this.scratchColor());

    // Pixel-perfect: only active for 1px brush; multi-pixel brushes skip it.
    if (this.ctx.getPixelPerfect() && this.offsets.length === 1) {
      const last = this._ppHistory[this._ppHistory.length - 1];
      if (!last || last.x !== x || last.y !== y) {
        this._ppHistory.push({ x, y });
        if (this._ppHistory.length > 3) this._ppHistory.shift();
        if (this._ppHistory.length === 3) this._checkElbow();
      }
    }

    // Mirror mode: paint mirrored coordinates
    const { h: mH, v: mV } = this.ctx.getMirrorMode();
    const mx = w - 1 - x;
    const my = h - 1 - y;
    if (mH && mx !== x) this.paintPixelRaw(mx, y, w, h);
    if (mV && my !== y) this.paintPixelRaw(x, my, w, h);
    if (mH && mV && mx !== x && my !== y) this.paintPixelRaw(mx, my, w, h);
  }

  private paintPixelRaw(x: number, y: number, w: number, h: number): void {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (!this.scratch || !this.layerBuf) return;
    const key = y * w + x;
    if (!this.deltas.has(key)) {
      const before = readPixel(this.layerBuf, x, y, w);
      this.deltas.set(key, { x, y, before, after: this.color });
    }
    writePixel(this.scratch, x, y, w, this.scratchColor());
  }

  private _checkElbow(): void {
    const p0 = this._ppHistory[0]!;
    const p1 = this._ppHistory[1]!;
    const p2 = this._ppHistory[2]!;
    const isElbow =
      (p1.x === p0.x && p1.y === p2.y) ||
      (p1.y === p0.y && p1.x === p2.x);
    if (!isElbow) return;
    this._eraseFromStroke(p1.x, p1.y);
    // Also erase mirrored elbow pixels so mirror mode stays consistent.
    const w = this.scratchW;
    const h = this.scratchH;
    const { h: mH, v: mV } = this.ctx.getMirrorMode();
    const mx = w - 1 - p1.x;
    const my = h - 1 - p1.y;
    if (mH && mx !== p1.x) this._eraseFromStroke(mx, p1.y);
    if (mV && my !== p1.y) this._eraseFromStroke(p1.x, my);
    if (mH && mV && mx !== p1.x && my !== p1.y) this._eraseFromStroke(mx, my);
  }

  private _eraseFromStroke(x: number, y: number): void {
    if (!this.scratch) return;
    // For paint strokes restore the committed layer pixel so it remains visible
    // through the scratch. For erase strokes (color=0) keep scratch transparent
    // so the DST_OUT pass does not cut through the layer at this pixel.
    const restore =
      this.color !== 0 && this.layerBuf
        ? readPixel(this.layerBuf, x, y, this.scratchW)
        : 0;
    writePixel(this.scratch, x, y, this.scratchW, restore);
    this.deltas.delete(y * this.scratchW + x);
  }

  private plotLine(x0: number, y0: number, x1: number, y1: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    const maxSteps = this.scratchW * this.scratchH + 1;
    for (let step = 0; step < maxSteps; step++) {
      this.paintFootprint(x, y);
      if (x === x1 && y === y1) return;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
}
