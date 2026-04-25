import type {
  CanvasPointerEvent,
  CursorDef,
  Tool,
  ToolEngineContext,
  ToolId,
} from '../ToolEngine';

/**
 * Zoom tool — left-click zooms in toward the cursor; Alt-click zooms out.
 * The actual zoom math (centering on the canvas point under the cursor) lives
 * in the bridge so it can read/write the UI store.
 */
export class ZoomTool implements Tool {
  readonly id: ToolId = 'zoom';
  readonly cursor: CursorDef = { type: 'zoom-in' };

  constructor(private readonly ctx: ToolEngineContext) {}

  onPointerDown(e: CanvasPointerEvent): void {
    if (e.button !== 0) return;
    const direction = e.altKey ? 'out' : 'in';
    this.ctx.zoomToward(e.canvasX, e.canvasY, direction);
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
  onCancel(): void {}
}
