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

/** Draws a 1px outline rectangle. Shift-constrains to a perfect square. */
export class RectangleTool implements Tool {
  readonly id: ToolId = 'rectangle';
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
    const [ex, ey] = this.constrainSquare(e.canvasX, e.canvasY, e.shiftKey);
    const sel = this.ctx.getSelection();
    const W = this.scratchW;
    const H = this.scratchH;
    const paint = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < W && y < H && isInSelection(sel, x, y))
        writePixel(this.scratch!, x, y, W, this.color);
    };
    const draw = (sx: number, sy: number, ex2: number, ey2: number) =>
      this.plotRect(sx, sy, ex2, ey2, paint);
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

    const [ex, ey] = this.constrainSquare(e.canvasX, e.canvasY, e.shiftKey);
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
      this.plotRect(sx, sy, ex2, ey2, collectPixel);
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
      'Rectangle',
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

  private constrainSquare(x: number, y: number, shift: boolean): [number, number] {
    if (!shift) return [x, y];
    const dx = x - this.startX;
    const dy = y - this.startY;
    const s = Math.min(Math.abs(dx), Math.abs(dy));
    return [this.startX + Math.sign(dx) * s, this.startY + Math.sign(dy) * s];
  }

  private plotRect(
    x0: number, y0: number, x1: number, y1: number,
    paint: (x: number, y: number) => void,
  ): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    for (let x = minX; x <= maxX; x++) { paint(x, minY); paint(x, maxY); }
    for (let y = minY + 1; y < maxY; y++) { paint(minX, y); paint(maxX, y); }
  }
}
