import type { CanvasPointerEvent, CursorDef, ToolEngineContext, ToolId } from '../ToolEngine';
import type { RGBA } from '../DataModel';
import { BrushTool } from './BrushTool';

/** 1px eraser — overwrites pixels with fully transparent (RGBA = 0). */
export class EraserTool extends BrushTool {
  readonly id: ToolId = 'eraser';
  readonly cursor: CursorDef = { type: 'crosshair' };

  constructor(ctx: ToolEngineContext) {
    super(ctx);
  }

  protected resolvePaintColor(): RGBA {
    return 0x00_00_00_00;
  }

  // Opaque black written to scratch so the DST_OUT blend has pixels to cut
  // through, giving a real-time preview of what will be erased.
  protected override scratchColor(): RGBA {
    return 0x000000ff;
  }

  protected describe(count: number): string {
    return `Erase (${count}px)`;
  }

  override onPointerDown(e: CanvasPointerEvent): void {
    this.ctx.setScratchErase(true);
    super.onPointerDown(e);
  }

  override onPointerUp(e: CanvasPointerEvent): void {
    super.onPointerUp(e);
    this.ctx.setScratchErase(false);
  }

  override onCancel(): void {
    super.onCancel();
    this.ctx.setScratchErase(false);
  }
}
