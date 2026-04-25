import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { LayerId, RGBA } from '../DataModel';
import { writePixel } from '../DataModel';

/** Per-pixel before/after for delta-based undo. */
export interface PixelDelta {
  x: number;
  y: number;
  before: RGBA;
  after: RGBA;
}

/**
 * Delta-based pixel mutation. Stores only the pixels that changed and their
 * before/after RGBA values — a 32-pixel stroke costs ~512 bytes regardless of
 * canvas size (architecture §5).
 *
 * The buffer is mutated in place; `onApplied` is responsible for re-uploading
 * to the GPU and marking the renderer dirty.
 */
export class DrawCommand implements Command {
  readonly id: string = nanoid(12);
  readonly description: string;

  constructor(
    private readonly layerId: LayerId,
    private readonly deltas: PixelDelta[],
    private readonly buffer: Uint8ClampedArray,
    private readonly canvasWidth: number,
    private readonly onApplied: (layerId: LayerId, buffer: Uint8ClampedArray) => void,
    description?: string,
  ) {
    this.description = description ?? `Draw (${deltas.length}px)`;
  }

  execute(): void {
    for (const d of this.deltas) {
      writePixel(this.buffer, d.x, d.y, this.canvasWidth, d.after);
    }
    this.onApplied(this.layerId, this.buffer);
  }

  undo(): void {
    for (const d of this.deltas) {
      writePixel(this.buffer, d.x, d.y, this.canvasWidth, d.before);
    }
    this.onApplied(this.layerId, this.buffer);
  }
}
