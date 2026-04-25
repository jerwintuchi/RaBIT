import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { Swatch } from '../DataModel';

/** Side-effect bridge for palette commands. */
export interface PaletteCommandDeps {
  insertSwatch(swatch: Swatch, index: number): void;
  removeSwatch(index: number): void;
  patchSwatch(index: number, patch: Partial<Swatch>): void;
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
