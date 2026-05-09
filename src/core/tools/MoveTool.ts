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
 * Moves pixels of the active layer by a drag offset.
 * If a marquee selection is active, only the selected pixels are moved and the
 * selection bounds follow the move. Without a selection, all non-transparent
 * pixels on the layer are moved.
 */
export class MoveTool implements Tool {
  readonly id: ToolId = 'move';
  readonly cursor: CursorDef = { type: 'move' };

  private active = false;
  private startX = 0;
  private startY = 0;

  private scratch: Uint8ClampedArray | null = null;
  private scratchW = 0;
  private scratchH = 0;

  private layerId: LayerId | null = null;
  private layerBuf: Uint8ClampedArray | null = null;
  private pixels: Array<{ x: number; y: number; color: RGBA }> = [];

  // Original selection bounds captured at drag start (for live overlay movement)
  private selBoundsAtStart: { x: number; y: number; w: number; h: number } | null = null;

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    if (this.ctx.isActiveLayerLocked()) return;
    const layerId = this.ctx.getActiveLayerId();
    if (!layerId) return;
    const layerBuf = this.ctx.getLayerData(layerId);
    if (!layerBuf) return;

    const { width, height } = this.ctx.getCanvasSize();
    this.ensureScratch(width, height);

    this.active = true;
    this.layerId = layerId;
    this.layerBuf = layerBuf;
    this.startX = e.canvasX;
    this.startY = e.canvasY;

    const selection = this.ctx.getSelection();

    if (selection) {
      // Snapshot original bounds so we can compute new overlay position live
      this.selBoundsAtStart = { ...selection.bounds };
      // Only snapshot pixels inside the selection
      const { bounds } = selection;
      // Use full mask data if it was built on pointerUp (not draft), otherwise use bounds
      const hasMask = selection.data.length > 1;
      for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (hasMask && !selection.data[y * selection.width + x]) continue;
          const c = readPixel(layerBuf, x, y, width);
          if ((c & 0xff) !== 0) this.pixels.push({ x, y, color: c });
        }
      }
    } else {
      this.selBoundsAtStart = null;
      // Move all non-transparent pixels on the layer
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const c = readPixel(layerBuf, x, y, width);
          if ((c & 0xff) !== 0) this.pixels.push({ x, y, color: c });
        }
      }
    }
  }

  onPointerMove(e: CanvasPointerEvent): void {
    if (!this.active) return;
    const dx = e.canvasX - this.startX;
    const dy = e.canvasY - this.startY;
    const w = this.scratchW;
    const h = this.scratchH;

    // Update scratch preview
    this.scratch!.fill(0);
    for (const { x, y, color } of this.pixels) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h)
        writePixel(this.scratch!, nx, ny, w, color);
    }
    this.ctx.updateScratch(this.scratch!);

    // Move the selection overlay live
    if (this.selBoundsAtStart) {
      const sel = this.ctx.getSelection();
      if (sel) {
        this.ctx.setSelection({
          ...sel,
          bounds: {
            x: this.selBoundsAtStart.x + dx,
            y: this.selBoundsAtStart.y + dy,
            w: this.selBoundsAtStart.w,
            h: this.selBoundsAtStart.h,
          },
        });
      }
    }
  }

  onPointerUp(e: CanvasPointerEvent): void {
    if (!this.active) return;
    this.active = false;
    const layerId = this.layerId;
    const layerBuf = this.layerBuf;
    this.layerId = null;
    this.layerBuf = null;
    this.ctx.clearScratch();

    const dx = e.canvasX - this.startX;
    const dy = e.canvasY - this.startY;

    if (!layerId || !layerBuf || this.pixels.length === 0) {
      this.pixels = [];
      this.selBoundsAtStart = null;
      return;
    }

    const w = this.scratchW;
    const h = this.scratchH;
    const deltaMap = new Map<number, PixelDelta>();

    // Erase originals
    for (const { x, y } of this.pixels) {
      const key = y * w + x;
      if (!deltaMap.has(key))
        deltaMap.set(key, { x, y, before: readPixel(layerBuf, x, y, w), after: 0 });
    }

    // Write at new positions
    for (const { x, y, color } of this.pixels) {
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

    const hadSelection = this.selBoundsAtStart !== null;
    const origBounds = this.selBoundsAtStart;
    this.pixels = [];
    this.selBoundsAtStart = null;

    // Commit selection at final position
    if (hadSelection && origBounds) {
      const nx = Math.max(0, origBounds.x + dx);
      const ny = Math.max(0, origBounds.y + dy);
      const nw = origBounds.w;
      const nh = origBounds.h;
      const newMask = new Uint8ClampedArray(w * h);
      for (let my = ny; my < ny + nh && my < h; my++)
        for (let mx = nx; mx < nx + nw && mx < w; mx++)
          newMask[my * w + mx] = 1;
      this.ctx.setSelection({
        data: newMask, width: w, height: h,
        bounds: { x: nx, y: ny, w: nw, h: nh },
      });
    }

    if (deltaMap.size === 0) return;
    const cmd = new DrawCommand(
      layerId, Array.from(deltaMap.values()), layerBuf, w,
      (id, data) => this.ctx.notifyLayerChanged(id, data),
      hadSelection ? 'Move selection' : 'Move layer',
    );
    this.ctx.executeCommand(cmd);
  }

  onCancel(): void {
    this.active = false;
    this.layerId = null;
    this.layerBuf = null;
    this.pixels = [];
    this.selBoundsAtStart = null;
    this.ctx.clearScratch();
  }

  private ensureScratch(w: number, h: number): void {
    if (!this.scratch || this.scratchW !== w || this.scratchH !== h) {
      this.scratch = new Uint8ClampedArray(w * h * 4);
      this.scratchW = w;
      this.scratchH = h;
    }
  }
}
