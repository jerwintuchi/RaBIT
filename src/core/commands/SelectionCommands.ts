import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { LayerId } from '../DataModel';
import { writePixel } from '../DataModel';

type NotifyFn = (layerId: LayerId, data: Uint8ClampedArray) => void;

/**
 * Generic pixel buffer swap command.
 * Stores before/after snapshots and swaps between them on execute/undo.
 */
export class PixelBufferCommand implements Command {
  readonly id: string = nanoid(12);

  constructor(
    readonly description: string,
    private readonly layerId: LayerId,
    private readonly buffer: Uint8ClampedArray,
    private readonly before: Uint8ClampedArray,
    private readonly after: Uint8ClampedArray,
    private readonly onApplied: NotifyFn,
  ) {}

  execute(): void {
    this.buffer.set(this.after);
    this.onApplied(this.layerId, this.buffer);
  }

  undo(): void {
    this.buffer.set(this.before);
    this.onApplied(this.layerId, this.buffer);
  }
}

// ── buildDeletedBuffer ───────────────────────────────────────────────────────

/**
 * Returns a copy of `buf` with all masked pixels set to transparent (alpha = 0).
 * `mask` is a 1-bit Uint8ClampedArray of size maskWidth×canvasHeight.
 */
export function buildDeletedBuffer(
  buf: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  maskWidth: number,
  canvasWidth: number,
  canvasHeight: number,
): Uint8ClampedArray {
  const after = new Uint8ClampedArray(buf);
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      if (mask[y * maskWidth + x] === 1) {
        writePixel(after, x, y, canvasWidth, 0);
      }
    }
  }
  return after;
}

// ── buildPastedBuffer ────────────────────────────────────────────────────────

/**
 * Returns a copy of `buf` with clipboard pixels merged (SRC_OVER) at the given offset.
 * `clipData` is a flat RGBA Uint8ClampedArray of size `clipW × clipH`.
 */
export function buildPastedBuffer(
  buf: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  clipData: Uint8ClampedArray,
  clipW: number,
  clipH: number,
  pasteX: number,
  pasteY: number,
): Uint8ClampedArray {
  const after = new Uint8ClampedArray(buf);
  for (let cy = 0; cy < clipH; cy++) {
    for (let cx = 0; cx < clipW; cx++) {
      const dx = pasteX + cx;
      const dy = pasteY + cy;
      if (dx < 0 || dy < 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
      const si = (cy * clipW + cx) * 4;
      const srcA = clipData[si + 3]!;
      if (srcA === 0) continue;
      const di = (dy * canvasWidth + dx) * 4;
      after[di] = clipData[si]!;
      after[di + 1] = clipData[si + 1]!;
      after[di + 2] = clipData[si + 2]!;
      after[di + 3] = srcA;
    }
  }
  return after;
}
