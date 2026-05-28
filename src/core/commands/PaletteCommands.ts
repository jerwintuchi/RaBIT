import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { RGBA, Swatch } from '../DataModel';
import { writePixel } from '../DataModel';

/** Side-effect bridge for palette commands. */
export interface PaletteCommandDeps {
  insertSwatch(swatch: Swatch, index: number): void;
  removeSwatch(index: number): void;
  patchSwatch(index: number, patch: Partial<Swatch>): void;
  reorderSwatches(fromIndex: number, toIndex: number): void;
}

// ── Add ────────────────────────────────────────────────────────────────────

export class AddSwatchCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Add swatch';

  constructor(
    private readonly swatch: Swatch,
    private readonly atIndex: number,
    private readonly deps: PaletteCommandDeps,
  ) {}

  execute(): void {
    this.deps.insertSwatch(this.swatch, this.atIndex);
  }
  undo(): void {
    this.deps.removeSwatch(this.atIndex);
  }
}

// ── Remove ─────────────────────────────────────────────────────────────────

export class RemoveSwatchCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Remove swatch';

  constructor(
    private readonly atIndex: number,
    private readonly swatch: Swatch,
    private readonly deps: PaletteCommandDeps,
  ) {}

  execute(): void {
    this.deps.removeSwatch(this.atIndex);
  }
  undo(): void {
    this.deps.insertSwatch(this.swatch, this.atIndex);
  }
}

// ── Update (color or name) ─────────────────────────────────────────────────

export class UpdateSwatchCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly atIndex: number,
    private readonly before: Partial<Swatch>,
    private readonly after: Partial<Swatch>,
    private readonly deps: PaletteCommandDeps,
    description?: string,
  ) {
    this.description = description ?? 'Update swatch';
  }

  execute(): void {
    this.deps.patchSwatch(this.atIndex, this.after);
  }
  undo(): void {
    this.deps.patchSwatch(this.atIndex, this.before);
  }
}

// ── Quantize to palette ────────────────────────────────────────────────────

interface QuantizeLayerOp {
  layerId: string;
  deltas: Array<{ offset: number; before: RGBA; after: RGBA }>;
  buf: Uint8ClampedArray;
  width: number;
  notify: (id: string, data: Uint8ClampedArray) => void;
}

export class QuantizeToPaletteCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Quantize to palette';

  constructor(private readonly ops: QuantizeLayerOp[]) {}

  execute(): void {
    for (const { layerId, deltas, buf, width, notify } of this.ops) {
      for (const { offset, after } of deltas) {
        writePixel(buf, offset % width, (offset / width) | 0, width, after);
      }
      notify(layerId, buf);
    }
  }

  undo(): void {
    for (const { layerId, deltas, buf, width, notify } of this.ops) {
      for (const { offset, before } of deltas) {
        writePixel(buf, offset % width, (offset / width) | 0, width, before);
      }
      notify(layerId, buf);
    }
  }
}

// ── Move (reorder) ─────────────────────────────────────────────────────────

export class MoveSwatchCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Reorder swatch';

  constructor(
    private readonly fromIndex: number,
    private readonly toIndex: number,
    private readonly deps: PaletteCommandDeps,
  ) {}

  execute(): void {
    this.deps.reorderSwatches(this.fromIndex, this.toIndex);
  }
  undo(): void {
    this.deps.reorderSwatches(this.toIndex, this.fromIndex);
  }
}
