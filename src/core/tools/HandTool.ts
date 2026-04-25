import type { CursorDef, Tool, ToolEngineContext, ToolId } from '../ToolEngine';

/**
 * Hand tool — pure cursor / passthrough. The actual pan logic lives in
 * `useViewportInteraction` which already pans on space-drag and middle-drag.
 * When Hand is active, the UI-layer hook also pans on left-drag, so this tool
 * never receives pointer events (the input-claimed ref blocks them).
 */
export class HandTool implements Tool {
  readonly id: ToolId = 'hand';
  readonly cursor: CursorDef = { type: 'grab' };

  // Intentionally accepts ctx for symmetry with other tool constructors,
  // even though Hand is a no-op (pan is handled by useViewportInteraction).
  constructor(_ctx: ToolEngineContext) {
    void _ctx;
  }

  onPointerDown(): void {}
  onPointerMove(): void {}
  onPointerUp(): void {}
  onCancel(): void {}
}
