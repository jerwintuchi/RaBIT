import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';

/**
 * Eyedropper — reads the composited pixel at the cursor and sets the primary
 * color. Reads from the GPU composite (what the user sees), not just the
 * active layer, so colors blended through transparency / blend modes are
 * sampled correctly.
 */
export class EyedropperTool implements Tool {
  readonly id: ToolId = 'eyedropper';
  readonly cursor: CursorDef = { type: 'crosshair' };

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    const { width, height } = this.ctx.getCanvasSize();
    if (e.canvasX < 0 || e.canvasY < 0 || e.canvasX >= width || e.canvasY >= height) return;
    const rgba = this.ctx.readCompositePixel(e.canvasX, e.canvasY);
    // Skip fully-transparent samples — they'd erase the user's primary color
    if ((rgba & 0xff) === 0) return;
    this.ctx.setPrimaryColor(rgba);
  }

  // Sampling on drag would be noisy — only commit on pointerDown
  onPointerMove(): void {}
  onPointerUp(): void {}
  onCancel(): void {}
}
