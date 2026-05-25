import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';
import type { SelectionMask } from '../ToolEngine/types';

/**
 * Magic Wand selection tool.
 *
 * On pointer-down:
 *   - For canvas > 512x512: delegates BFS to Rust via ctx.computeSelectionRust().
 *   - For smaller canvases: runs an inline JS BFS flood-fill via readCompositePixel.
 * Sets the resulting SelectionMask on the context.
 */
export class MagicWandTool implements Tool {
  readonly id: ToolId = 'magic-wand';
  readonly cursor: CursorDef = { type: 'crosshair' };

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    void this._performSelection(e.canvasX, e.canvasY);
  }

  onPointerMove(_e: CanvasPointerEvent): void {
    // no-op
  }

  onPointerUp(_e: CanvasPointerEvent): void {
    // no-op
  }

  onCancel(): void {
    // no-op
  }

  private async _performSelection(startX: number, startY: number): Promise<void> {
    const { width, height } = this.ctx.getCanvasSize();
    const tolerance = this.ctx.getMagicWandTolerance();

    let mask: SelectionMask | null = null;

    if (width > 512 || height > 512) {
      mask = await this.ctx.computeSelectionRust(startX, startY, tolerance);
      if (!mask) {
        mask = this._jsBFS(startX, startY, tolerance, width, height);
      }
    } else {
      mask = this._jsBFS(startX, startY, tolerance, width, height);
    }

    if (mask) {
      this.ctx.setSelection(mask);
    }
  }

  private _jsBFS(
    startX: number,
    startY: number,
    tolerance: number,
    width: number,
    height: number,
  ): SelectionMask | null {
    const target = this.ctx.readCompositePixel(startX, startY);
    const tr = (target >>> 24) & 0xff;
    const tg = (target >>> 16) & 0xff;
    const tb = (target >>> 8) & 0xff;
    const ta = target & 0xff;

    const maskData = new Uint8ClampedArray(width * height);
    const visited = new Uint8ClampedArray(width * height);

    const queue: number[] = [];
    const startIdx = startY * width + startX;
    queue.push(startIdx);
    visited[startIdx] = 1;

    let minX = startX, minY = startY, maxX = startX, maxY = startY;

    while (queue.length > 0) {
      const idx = queue.shift()!;
      const x = idx % width;
      const y = Math.floor(idx / width);

      const pixel = this.ctx.readCompositePixel(x, y);
      const r = (pixel >>> 24) & 0xff;
      const g = (pixel >>> 16) & 0xff;
      const b = (pixel >>> 8) & 0xff;
      const a = pixel & 0xff;

      // Alpha boundary: opaque seed stops at transparent pixels (and vice versa)
      if (ta > 0 && a === 0) continue;
      if (ta === 0 && a > 0) continue;

      const diff = Math.max(
        Math.abs(r - tr),
        Math.abs(g - tg),
        Math.abs(b - tb),
        Math.abs(a - ta),
      );
      if (diff > tolerance) continue;

      maskData[idx] = 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const neighbors: number[] = [];
      if (x > 0) neighbors.push(idx - 1);
      if (x < width - 1) neighbors.push(idx + 1);
      if (y > 0) neighbors.push(idx - width);
      if (y < height - 1) neighbors.push(idx + width);

      for (const n of neighbors) {
        if (!visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }

    const hasSelection = maskData.some((v) => v === 1);
    if (!hasSelection) return null;

    return {
      data: maskData,
      width,
      height,
      bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    };
  }
}
