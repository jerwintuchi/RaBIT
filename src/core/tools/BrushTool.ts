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

  protected constructor(protected readonly ctx: ToolEngineContext) {}

  /** Called per-stroke to determine the paint color (e.g. primary or transparent). */
  protected abstract resolvePaintColor(): RGBA;

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

    this.paintPixel(e.canvasX, e.canvasY);
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

  private paintPixel(x: number, y: number): void {
    const w = this.scratchW;
    const h = this.scratchH;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (!this.scratch || !this.layerBuf) return;

    const key = y * w + x;
    if (!this.deltas.has(key)) {
      const before = readPixel(this.layerBuf, x, y, w);
      this.deltas.set(key, { x, y, before, after: this.color });
    }
    writePixel(this.scratch, x, y, w, this.color);
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
      this.paintPixel(x, y);
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
