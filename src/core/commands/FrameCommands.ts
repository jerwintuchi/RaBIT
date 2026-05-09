import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { Cell, Frame, FrameId, LayerId } from '../DataModel';

/**
 * Side-effect bridge for frame commands. Supplied by the state layer so
 * commands can mutate stores without importing them (Core ↛ State).
 */
export interface FrameCommandDeps {
  insertFrame(frame: Frame, index: number): void;
  removeFrame(id: FrameId): void;
  setFrames(frames: Frame[]): void;
  setActiveFrameIndex(index: number): void;
  reorderFrames(fromIndex: number, toIndex: number): void;
  setFrameDuration(id: FrameId, duration: number): void;
  setCell(frameId: FrameId, layerId: LayerId, cell: Cell): void;
  clearCell(frameId: FrameId, layerId: LayerId, canvasW: number, canvasH: number): void;
  notifyFrameChanged(): void;
}

// ── Add ─────────────────────────────────────────────────────────────────────

export class AddFrameCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly frame: Frame,
    private readonly insertIndex: number,
    private readonly priorActiveIndex: number,
    private readonly deps: FrameCommandDeps,
  ) {
    this.description = `Add frame ${insertIndex + 1}`;
  }

  execute(): void {
    this.deps.insertFrame(this.frame, this.insertIndex);
    this.deps.setActiveFrameIndex(this.insertIndex);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    this.deps.removeFrame(this.frame.id);
    this.deps.setActiveFrameIndex(this.priorActiveIndex);
    this.deps.notifyFrameChanged();
  }
}

// ── Remove ───────────────────────────────────────────────────────────────────

export class RemoveFrameCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly frame: Frame,
    private readonly frameIndex: number,
    private readonly priorActiveIndex: number,
    private readonly nextActiveIndex: number,
    private readonly deps: FrameCommandDeps,
  ) {
    this.description = `Delete frame ${frameIndex + 1}`;
  }

  execute(): void {
    this.deps.removeFrame(this.frame.id);
    this.deps.setActiveFrameIndex(this.nextActiveIndex);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    this.deps.insertFrame(this.frame, this.frameIndex);
    this.deps.setActiveFrameIndex(this.priorActiveIndex);
    this.deps.notifyFrameChanged();
  }
}

// ── Duplicate ────────────────────────────────────────────────────────────────

export class DuplicateFrameCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly duplicate: Frame,
    private readonly insertIndex: number,
    private readonly priorActiveIndex: number,
    private readonly deps: FrameCommandDeps,
  ) {
    this.description = `Duplicate frame ${insertIndex + 1}`;
  }

  execute(): void {
    this.deps.insertFrame(this.duplicate, this.insertIndex);
    this.deps.setActiveFrameIndex(this.insertIndex);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    this.deps.removeFrame(this.duplicate.id);
    this.deps.setActiveFrameIndex(this.priorActiveIndex);
    this.deps.notifyFrameChanged();
  }
}

// ── Reorder ──────────────────────────────────────────────────────────────────

export class ReorderFrameCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Reorder frame';

  constructor(
    private readonly fromIndex: number,
    private readonly toIndex: number,
    private readonly deps: FrameCommandDeps,
  ) {}

  execute(): void {
    this.deps.reorderFrames(this.fromIndex, this.toIndex);
    this.deps.setActiveFrameIndex(this.toIndex);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    this.deps.reorderFrames(this.toIndex, this.fromIndex);
    this.deps.setActiveFrameIndex(this.fromIndex);
    this.deps.notifyFrameChanged();
  }
}

// ── Reorder multiple ─────────────────────────────────────────────────────────

export class ReorderMultipleFramesCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Reorder frames';

  constructor(
    private readonly beforeFrames: Frame[],
    private readonly afterFrames: Frame[],
    private readonly beforeActiveIndex: number,
    private readonly afterActiveIndex: number,
    private readonly deps: FrameCommandDeps,
  ) {}

  execute(): void {
    this.deps.setFrames(this.afterFrames);
    this.deps.setActiveFrameIndex(this.afterActiveIndex);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    this.deps.setFrames(this.beforeFrames);
    this.deps.setActiveFrameIndex(this.beforeActiveIndex);
    this.deps.notifyFrameChanged();
  }
}

// ── Batch insert (multi-duplicate) ───────────────────────────────────────────

export class BatchInsertFramesCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly newFrames: Frame[], // frames to insert, in order
    private readonly insertAt: number,   // index in the ORIGINAL array to insert before
    private readonly priorActiveIndex: number,
    private readonly deps: FrameCommandDeps,
  ) {
    this.description = `Duplicate ${newFrames.length} frame${newFrames.length !== 1 ? 's' : ''}`;
  }

  execute(): void {
    // Insert in reverse so each insertion doesn't shift subsequent insertAt positions
    for (let i = this.newFrames.length - 1; i >= 0; i--) {
      this.deps.insertFrame(this.newFrames[i]!, this.insertAt);
    }
    this.deps.setActiveFrameIndex(this.insertAt + this.newFrames.length - 1);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    // All new frames were inserted starting at insertAt — remove them by ID
    for (const frame of this.newFrames) {
      this.deps.removeFrame(frame.id);
    }
    this.deps.setActiveFrameIndex(this.priorActiveIndex);
    this.deps.notifyFrameChanged();
  }
}

// ── Set duration ─────────────────────────────────────────────────────────────

export class SetFrameDurationCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Set frame duration';

  constructor(
    private readonly frameId: FrameId,
    private readonly before: number,
    private readonly after: number,
    private readonly deps: FrameCommandDeps,
  ) {}

  execute(): void {
    this.deps.setFrameDuration(this.frameId, this.after);
  }

  undo(): void {
    this.deps.setFrameDuration(this.frameId, this.before);
  }

  merge(other: Command): Command | null {
    if (other instanceof SetFrameDurationCommand && other.frameId === this.frameId) {
      return new SetFrameDurationCommand(this.frameId, this.before, other.after, this.deps);
    }
    return null;
  }
}

// ── Clear cell ───────────────────────────────────────────────────────────────

export class ClearCellCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Clear cell';

  constructor(
    private readonly frameId: FrameId,
    private readonly layerId: LayerId,
    private readonly before: Cell,
    private readonly canvasW: number,
    private readonly canvasH: number,
    private readonly deps: FrameCommandDeps,
  ) {}

  execute(): void {
    this.deps.clearCell(this.frameId, this.layerId, this.canvasW, this.canvasH);
    this.deps.notifyFrameChanged();
  }

  undo(): void {
    this.deps.setCell(this.frameId, this.layerId, this.before);
    this.deps.notifyFrameChanged();
  }
}
