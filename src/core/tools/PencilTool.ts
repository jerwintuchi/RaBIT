import type { CursorDef, ToolEngineContext, ToolId } from '../ToolEngine';
import type { RGBA } from '../DataModel';
import { BrushTool } from './BrushTool';

/** 1px hard-edged pencil — paints with the active primary color. */
export class PencilTool extends BrushTool {
  readonly id: ToolId = 'pencil';
  readonly cursor: CursorDef = { type: 'crosshair' };

  constructor(ctx: ToolEngineContext) {
    super(ctx);
  }

  protected resolvePaintColor(): RGBA {
    return this.ctx.snapColorIfIndexed(this.ctx.getPrimaryColor());
  }

  protected describe(count: number): string {
    return `Pencil (${count}px)`;
  }
}
