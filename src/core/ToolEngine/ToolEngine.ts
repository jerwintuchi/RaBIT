import type { CanvasPointerEvent, Tool, ToolEngineContext, ToolId } from './types';

/** Raw pointer event input from the UI layer (stripped of DOM types). */
export interface RawPointerInput {
  screenX: number; // pointer X in viewport pixels (relative to GL canvas)
  screenY: number;
  pressure: number;
  button: 0 | 1 | 2;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
}

/** View transform for screen→canvas coordinate normalization. */
export interface ToolViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

/**
 * Coordinates tool lifecycles. Owns the tool registry and routes normalized
 * pointer events to the active tool.
 */
export class ToolEngine {
  private tools = new Map<ToolId, Tool>();
  private active: Tool | null = null;
  private transform: ToolViewTransform = { panX: 0, panY: 0, zoom: 1 };

  constructor(private readonly context: ToolEngineContext) {}

  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
    if (!this.active) this.active = tool;
  }

  setActiveTool(id: ToolId): void {
    const next = this.tools.get(id);
    if (!next) return;
    if (this.active && this.active !== next) this.active.onCancel();
    this.active = next;
  }

  getActiveTool(): Tool | null {
    return this.active;
  }

  setTransform(panX: number, panY: number, zoom: number): void {
    this.transform = { panX, panY, zoom };
  }

  pointerDown(input: RawPointerInput): void {
    const evt = this.normalize(input);
    if (!evt) return;
    this.active?.onPointerDown(evt);
  }

  pointerMove(input: RawPointerInput): void {
    const evt = this.normalize(input, /* allowOutOfBounds */ true);
    if (!evt) return;
    this.active?.onPointerMove(evt);
  }

  pointerUp(input: RawPointerInput): void {
    const evt = this.normalize(input, /* allowOutOfBounds */ true);
    if (!evt) return;
    this.active?.onPointerUp(evt);
  }

  cancel(): void {
    this.active?.onCancel();
  }

  keyDown(e: KeyboardEvent): void {
    this.active?.onKeyDown?.(e);
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private normalize(
    input: RawPointerInput,
    allowOutOfBounds = false,
  ): CanvasPointerEvent | null {
    const { panX, panY, zoom } = this.transform;
    const canvasX = Math.floor((input.screenX - panX) / zoom);
    const canvasY = Math.floor((input.screenY - panY) / zoom);
    if (!allowOutOfBounds) {
      const { width, height } = this.context.getCanvasSize();
      if (canvasX < 0 || canvasY < 0 || canvasX >= width || canvasY >= height) {
        return null;
      }
    }
    return {
      canvasX,
      canvasY,
      pressure: input.pressure,
      button: input.button,
      altKey: input.altKey,
      shiftKey: input.shiftKey,
      ctrlKey: input.ctrlKey,
    };
  }
}
