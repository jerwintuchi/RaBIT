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
import { isInSelection } from '../ToolEngine/types';

/**
 * Straight-line tool. Previews the line on the scratch buffer during drag,
 * commits a single DrawCommand on pointerUp. Shift-constrains to 0/45/90°.
 */
export class LineTool implements Tool {
  readonly id: ToolId = 'line';
  readonly cursor: CursorDef = { type: 'crosshair' };

  private active = false;
  private startX = 0;
  private startY = 0;

  private scratch: Uint8ClampedArray | null = null;
  private scratchW = 0;
  private scratchH = 0;

  private layerId: LayerId | null = null;
  private layerBuf: Uint8ClampedArray | null = null;
  private color: RGBA = 0;

  constructor(private readonly ctx: ToolEngineContext) {}

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
    this.active = true;
    this.layerId = layerId;
    this.layerBuf = layerBuf;
    this.color = this.ctx.snapColorIfIndexed(this.ctx.getPrimaryColor());
    this.startX = e.canvasX;
    this.startY = e.canvasY;

    // Single starting pixel preview
    writePixel(this.scratch!, e.canvasX, e.canvasY, this.scratchW, this.color);
    this.ctx.updateScratch(this.scratch!);
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.scratch!.fill(0);
    const [endX, endY] = this.constrainEndpoint(e.canvasX, e.canvasY, e.shiftKey);
    const sel = this.ctx.getSelection();
    const W = this.scratchW;
    const H = this.scratchH;
    const paint = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      if (!isInSelection(sel, x, y)) return;
      writePixel(this.scratch!, x, y, W, this.color);
    };
    const draw = (sx: number, sy: number, ex: number, ey: number) =>
      this.plotLine(sx, sy, ex, ey, paint);
    const { h: mH, v: mV } = this.ctx.getMirrorMode();
    draw(this.startX, this.startY, endX, endY);
    if (mH) draw(W - 1 - this.startX, this.startY, W - 1 - endX, endY);
    if (mV) draw(this.startX, H - 1 - this.startY, endX, H - 1 - endY);
    if (mH && mV) draw(W - 1 - this.startX, H - 1 - this.startY, W - 1 - endX, H - 1 - endY);
    this.ctx.updateScratch(this.scratch!);
  }

  onPointerUp(e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.active = false;

    const layerId = this.layerId;
    const layerBuf = this.layerBuf;
    this.layerId = null;
    this.layerBuf = null;
    if (!layerId || !layerBuf) {
      this.ctx.clearScratch();
      return;
    }

    const [endX, endY] = this.constrainEndpoint(e.canvasX, e.canvasY, e.shiftKey);
    const w = this.scratchW;
    const H = this.scratchH;
    const sel = this.ctx.getSelection();
    const deltas = new Map<number, PixelDelta>();
    const collectPixel = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= H) return;
      if (!isInSelection(sel, x, y)) return;
      const key = y * w + x;
      if (!deltas.has(key)) {
        deltas.set(key, { x, y, before: readPixel(layerBuf, x, y, w), after: this.color });
      }
    };
    const collect = (sx: number, sy: number, ex: number, ey: number) =>
      this.plotLine(sx, sy, ex, ey, collectPixel);
    const { h: mH, v: mV } = this.ctx.getMirrorMode();
    collect(this.startX, this.startY, endX, endY);
    if (mH) collect(w - 1 - this.startX, this.startY, w - 1 - endX, endY);
    if (mV) collect(this.startX, H - 1 - this.startY, endX, H - 1 - endY);
    if (mH && mV) collect(w - 1 - this.startX, H - 1 - this.startY, w - 1 - endX, H - 1 - endY);

    this.ctx.clearScratch();
    if (deltas.size === 0) return;

    const cmd = new DrawCommand(
      layerId,
      Array.from(deltas.values()),
      layerBuf,
      w,
      (id, data) => this.ctx.notifyLayerChanged(id, data),
      `Line (${deltas.size}px)`,
    );
    this.ctx.executeCommand(cmd);
  }

  onCancel(): void {
    this.active = false;
    this.layerId = null;
    this.layerBuf = null;
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

  /** Snap (x, y) to nearest 0/45/90° angle from (startX, startY) when shift is held. */
  private constrainEndpoint(x: number, y: number, shift: boolean): [number, number] {
    if (!shift) return [x, y];
    const dx = x - this.startX;
    const dy = y - this.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx > 2 * ady) return [x, this.startY]; // horizontal
    if (ady > 2 * adx) return [this.startX, y]; // vertical
    // diagonal
    const len = Math.min(adx, ady);
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    return [this.startX + sx * len, this.startY + sy * len];
  }

  private plotLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    paint: (x: number, y: number) => void,
  ): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    const maxSteps = dx + dy + 2;
    for (let step = 0; step < maxSteps; step++) {
      paint(x, y);
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
