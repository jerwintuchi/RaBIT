import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';

export class LassoTool implements Tool {
  readonly id: ToolId = 'lasso';
  readonly cursor: CursorDef = { type: 'crosshair' };

  private active = false;
  private path: Array<{ x: number; y: number }> = [];

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    this.path = [{ x: e.canvasX, y: e.canvasY }];
    this.active = true;
    this.ctx.setLassoPreviewPath([...this.path]);
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (!this.active) return;
    const last = this.path[this.path.length - 1]!;
    if (e.canvasX === last.x && e.canvasY === last.y) return;
    this.path.push({ x: e.canvasX, y: e.canvasY });
    this.ctx.setLassoPreviewPath([...this.path]);
  }

  onPointerUp(_e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.active = false;
    this.ctx.setLassoPreviewPath([]);

    if (this.path.length < 3) {
      this.path = [];
      this.ctx.clearSelection();
      return;
    }

    const { width, height } = this.ctx.getCanvasSize();
    const mask = this.scanlineFill(this.path, width, height);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    this.path = [];

    if (maxX < 0) {
      this.ctx.clearSelection();
      return;
    }

    this.ctx.setSelection({
      data: mask,
      width,
      height,
      bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    });
  }

  onCancel(): void {
    this.active = false;
    this.path = [];
    this.ctx.setLassoPreviewPath([]);
  }

  // ── internals ──────────────────────────────────────────────────────────────


  /**
   * Standard even-odd scanline polygon fill.
   * For each row y, find edge crossings at y+0.5, sort them, fill pairs.
   */
  private scanlineFill(
    pts: Array<{ x: number; y: number }>,
    w: number,
    h: number,
  ): Uint8ClampedArray {
    const mask = new Uint8ClampedArray(w * h);
    const n = pts.length;
    if (n < 3) return mask;

    for (let y = 0; y < h; y++) {
      const fy = y + 0.5;
      const xs: number[] = [];

      for (let i = 0; i < n; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % n]!;
        const ay = a.y;
        const by = b.y;
        if ((ay <= fy && by > fy) || (by <= fy && ay > fy)) {
          // x intersection of edge a→b at y = fy
          xs.push(a.x + ((fy - ay) / (by - ay)) * (b.x - a.x));
        }
      }

      xs.sort((a, b) => a - b);

      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k]!));
        const x1 = Math.min(w - 1, Math.floor(xs[k + 1]!));
        for (let x = x0; x <= x1; x++) {
          mask[y * w + x] = 1;
        }
      }
    }

    return mask;
  }
}
