import type { LayerId, RGBA } from '../DataModel';
import { readPixel, writePixel } from '../DataModel';
import { isInSelection } from '../ToolEngine/types';
import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';
import { DrawCommand, type PixelDelta } from '../commands/DrawCommand';

/** Draws a 1px outline ellipse fitted to the drag bounding box. Shift = circle. */
export class EllipseTool implements Tool {
  readonly id: ToolId = 'ellipse';
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

    writePixel(this.scratch!, e.canvasX, e.canvasY, this.scratchW, this.color);
    this.ctx.updateScratch(this.scratch!);
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.scratch!.fill(0);
    const [ex, ey] = this.constrainCircle(e.canvasX, e.canvasY, e.shiftKey);
    const sel = this.ctx.getSelection();
    const W = this.scratchW;
    const H = this.scratchH;
    const paint = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < W && y < H && isInSelection(sel, x, y))
        writePixel(this.scratch!, x, y, W, this.color);
    };
    const draw = (sx: number, sy: number, ex2: number, ey2: number) =>
      this.plotEllipse(sx, sy, ex2, ey2, paint);
    const { h: mH, v: mV } = this.ctx.getMirrorMode();
    draw(this.startX, this.startY, ex, ey);
    if (mH) draw(W - 1 - this.startX, this.startY, W - 1 - ex, ey);
    if (mV) draw(this.startX, H - 1 - this.startY, ex, H - 1 - ey);
    if (mH && mV) draw(W - 1 - this.startX, H - 1 - this.startY, W - 1 - ex, H - 1 - ey);
    this.ctx.updateScratch(this.scratch!);
  }

  onPointerUp(e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.active = false;
    const layerId = this.layerId;
    const layerBuf = this.layerBuf;
    this.layerId = null;
    this.layerBuf = null;
    if (!layerId || !layerBuf) { this.ctx.clearScratch(); return; }

    const [ex, ey] = this.constrainCircle(e.canvasX, e.canvasY, e.shiftKey);
    const w = this.scratchW;
    const H = this.scratchH;
    const sel = this.ctx.getSelection();
    const deltas = new Map<number, PixelDelta>();
    const collectPixel = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= H) return;
      if (!isInSelection(sel, x, y)) return;
      const key = y * w + x;
      if (!deltas.has(key))
        deltas.set(key, { x, y, before: readPixel(layerBuf, x, y, w), after: this.color });
    };
    const collect = (sx: number, sy: number, ex2: number, ey2: number) =>
      this.plotEllipse(sx, sy, ex2, ey2, collectPixel);
    const { h: mH, v: mV } = this.ctx.getMirrorMode();
    collect(this.startX, this.startY, ex, ey);
    if (mH) collect(w - 1 - this.startX, this.startY, w - 1 - ex, ey);
    if (mV) collect(this.startX, H - 1 - this.startY, ex, H - 1 - ey);
    if (mH && mV) collect(w - 1 - this.startX, H - 1 - this.startY, w - 1 - ex, H - 1 - ey);

    this.ctx.clearScratch();
    if (deltas.size === 0) return;
    const cmd = new DrawCommand(
      layerId, Array.from(deltas.values()), layerBuf, w,
      (id, data) => this.ctx.notifyLayerChanged(id, data),
      'Ellipse',
    );
    this.ctx.executeCommand(cmd);
  }

  onCancel(): void {
    this.active = false;
    this.layerId = null;
    this.layerBuf = null;
    this.ctx.clearScratch();
  }

  private ensureScratch(w: number, h: number): void {
    if (!this.scratch || this.scratchW !== w || this.scratchH !== h) {
      this.scratch = new Uint8ClampedArray(w * h * 4);
      this.scratchW = w;
      this.scratchH = h;
    }
  }

  private constrainCircle(x: number, y: number, shift: boolean): [number, number] {
    if (!shift) return [x, y];
    const dx = x - this.startX;
    const dy = y - this.startY;
    const s = Math.min(Math.abs(dx), Math.abs(dy));
    return [this.startX + Math.sign(dx) * s, this.startY + Math.sign(dy) * s];
  }

  /**
   * Zingl-Bresenham ellipse outline for integer bounding box.
   * Handles all dimensions including odd widths/heights correctly.
   * Reference: Alois Zingl, "A Rasterizing Algorithm for Drawing Curves" (2012).
   */
  private plotEllipse(
    x0: number, y0: number, x1: number, y1: number,
    paint: (x: number, y: number) => void,
  ): void {
    let lx0 = Math.min(x0, x1);
    let lx1 = Math.max(x0, x1);
    let ly0 = Math.min(y0, y1);
    let ly1 = Math.max(y0, y1);

    let a = lx1 - lx0;
    let b = ly1 - ly0;
    const b1 = b & 1;

    if (a === 0 && b === 0) { paint(lx0, ly0); return; }
    if (a === 0) { for (let y = ly0; y <= ly1; y++) paint(lx0, y); return; }
    if (b === 0) { for (let x = lx0; x <= lx1; x++) paint(x, ly0); return; }

    let dx = 4 * (1 - a) * b * b;
    let dy = 4 * (b1 + 1) * a * a;
    let err = dx + dy + b1 * a * a;

    ly0 += Math.floor((b + 1) / 2);
    ly1 = ly0 - b1;
    a = 8 * a * a;
    b = 8 * b * b;   // reused as b1 multiplier below (not the semi-axis anymore)

    do {
      paint(lx1, ly0); paint(lx0, ly0);
      paint(lx0, ly1); paint(lx1, ly1);
      const e2 = 2 * err;
      if (e2 <= dy) { ly0++; ly1--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { lx0++; lx1--; err += dx += b; }
    } while (lx0 <= lx1);

    // Finish flat ellipses where the loop exits too early
    while (ly0 - ly1 <= (ly1 < ly0 ? 0 : b)) {
      paint(lx0 - 1, ly0); paint(lx1 + 1, ly0++);
      paint(lx0 - 1, ly1); paint(lx1 + 1, ly1--);
    }
  }
}
