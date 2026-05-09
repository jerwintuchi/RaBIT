import { readPixel } from '../DataModel';
import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';
import { DrawCommand, type PixelDelta } from '../commands/DrawCommand';
import { isInSelection } from '../ToolEngine/types';
import type { SelectionMask } from '../ToolEngine/types';

/** Flood-fills contiguous pixels that match the clicked color within tolerance. */
export class FillTool implements Tool {
  readonly id: ToolId = 'fill';
  readonly cursor: CursorDef = { type: 'crosshair' };

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

    const color = this.ctx.getPrimaryColor();
    const tolerance = this.ctx.getFillTolerance();
    const selection = this.ctx.getSelection();
    if (selection && !isInSelection(selection, e.canvasX, e.canvasY)) return;
    const deltas = this.floodFill(layerBuf, width, height, e.canvasX, e.canvasY, color, tolerance, selection);
    if (deltas.length === 0) return;

    const cmd = new DrawCommand(
      layerId, deltas, layerBuf, width,
      (id, data) => this.ctx.notifyLayerChanged(id, data),
      'Fill',
    );
    this.ctx.executeCommand(cmd);
  }

  onPointerMove(_e: CanvasPointerEvent): void {}
  onPointerUp(_e: CanvasPointerEvent): void {}
  onCancel(): void {}

  private floodFill(
    buf: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    fillColor: number,
    tolerance: number,
    selection: SelectionMask | null,
  ): PixelDelta[] {
    const targetColor = readPixel(buf, startX, startY, width);
    if (targetColor === fillColor) return [];

    const visited = new Uint8Array(width * height);
    const deltas: PixelDelta[] = [];
    // Use a stack (DFS) — better cache locality than a queue for nearby pixels
    const stack: number[] = [startY * width + startX];
    visited[startY * width + startX] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = (idx / width) | 0;
      deltas.push({ x, y, before: readPixel(buf, x, y, width), after: fillColor });

      const neighbors: [number, number][] = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (!isInSelection(selection, nx, ny)) continue;
        const nidx = ny * width + nx;
        if (visited[nidx]) continue;
        if (this.colorDist(readPixel(buf, nx, ny, width), targetColor) <= tolerance) {
          visited[nidx] = 1;
          stack.push(nidx);
        }
      }
    }

    return deltas;
  }

  /** Max-channel color distance (Chebyshev). */
  private colorDist(a: number, b: number): number {
    return Math.max(
      Math.abs(((a >>> 24) & 0xff) - ((b >>> 24) & 0xff)),
      Math.abs(((a >>> 16) & 0xff) - ((b >>> 16) & 0xff)),
      Math.abs(((a >>> 8)  & 0xff) - ((b >>> 8)  & 0xff)),
      Math.abs(( a         & 0xff) - ( b         & 0xff)),
    );
  }
}
