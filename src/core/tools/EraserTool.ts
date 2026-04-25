import type { CursorDef, ToolEngineContext, ToolId } from '../ToolEngine';
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

  protected describe(count: number): string {
    return `Erase (${count}px)`;
  }
}
