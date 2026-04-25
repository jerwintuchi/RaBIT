import { nanoid } from 'nanoid';
import type { Command } from '../CommandSystem';
import type { BlendMode, Cell, FrameId, Layer, LayerId } from '../DataModel';

/**
 * Side-effect bridge for layer commands. The state layer supplies these so
 * commands can mutate stores without importing them (Core ↛ State).
 */
export interface LayerCommandDeps {
  // Layer store ops
  insertLayer(layer: Layer, index: number): void;
  removeLayer(id: LayerId): void;
  patchLayer(id: LayerId, patch: Partial<Omit<Layer, 'id'>>): void;
  reorderLayers(fromIndex: number, toIndex: number): void;
  setActiveLayer(id: LayerId | null): void;

  // Frame store ops (cells)
  setCell(frameId: FrameId, layerId: LayerId, cell: Cell): void;
  removeCell(frameId: FrameId, layerId: LayerId): void;

  // Renderer / texture cache invalidation when a layer's identity changes
  invalidateLayerTexture(layerId: LayerId): void;
  /** Re-derive layer specs in the renderer (order/visibility/opacity/blendMode). */
  notifyLayerListChanged(): void;
}

// ── Add ────────────────────────────────────────────────────────────────────

export class AddLayerCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly layer: Layer,
    private readonly cellsByFrame: Map<FrameId, Cell>,
    private readonly insertAtIndex: number,
    private readonly priorActiveLayerId: LayerId | null,
    private readonly deps: LayerCommandDeps,
  ) {
    this.description = `Add layer "${layer.name}"`;
  }

  execute(): void {
    this.deps.insertLayer(this.layer, this.insertAtIndex);
    for (const [frameId, cell] of this.cellsByFrame) {
      this.deps.setCell(frameId, this.layer.id, cell);
    }
    this.deps.setActiveLayer(this.layer.id);
    this.deps.notifyLayerListChanged();
  }

  undo(): void {
    for (const frameId of this.cellsByFrame.keys()) {
      this.deps.removeCell(frameId, this.layer.id);
    }
    this.deps.removeLayer(this.layer.id);
    this.deps.invalidateLayerTexture(this.layer.id);
    this.deps.setActiveLayer(this.priorActiveLayerId);
    this.deps.notifyLayerListChanged();
  }
}

// ── Remove ─────────────────────────────────────────────────────────────────

export class RemoveLayerCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly layer: Layer,
    private readonly cellsByFrame: Map<FrameId, Cell>,
    private readonly priorIndex: number,
    private readonly priorActiveLayerId: LayerId | null,
    private readonly nextActiveLayerId: LayerId | null,
    private readonly deps: LayerCommandDeps,
  ) {
    this.description = `Delete layer "${layer.name}"`;
  }

  execute(): void {
    for (const frameId of this.cellsByFrame.keys()) {
      this.deps.removeCell(frameId, this.layer.id);
    }
    this.deps.removeLayer(this.layer.id);
    this.deps.invalidateLayerTexture(this.layer.id);
    this.deps.setActiveLayer(this.nextActiveLayerId);
    this.deps.notifyLayerListChanged();
  }

  undo(): void {
    this.deps.insertLayer(this.layer, this.priorIndex);
    for (const [frameId, cell] of this.cellsByFrame) {
      this.deps.setCell(frameId, this.layer.id, cell);
    }
    this.deps.setActiveLayer(this.priorActiveLayerId);
    this.deps.notifyLayerListChanged();
  }
}

// ── Reorder ────────────────────────────────────────────────────────────────

export class ReorderLayerCommand implements Command {
  readonly id = nanoid(12);
  readonly description = 'Reorder layer';

  constructor(
    private readonly fromIndex: number,
    private readonly toIndex: number,
    private readonly deps: LayerCommandDeps,
  ) {}

  execute(): void {
    this.deps.reorderLayers(this.fromIndex, this.toIndex);
    this.deps.notifyLayerListChanged();
  }

  undo(): void {
    this.deps.reorderLayers(this.toIndex, this.fromIndex);
    this.deps.notifyLayerListChanged();
  }
}

// ── Property setters ───────────────────────────────────────────────────────

abstract class PatchLayerCommand implements Command {
  readonly id = nanoid(12);
  abstract readonly description: string;

  constructor(
    protected readonly layerId: LayerId,
    protected readonly before: Partial<Omit<Layer, 'id'>>,
    protected readonly after: Partial<Omit<Layer, 'id'>>,
    protected readonly deps: LayerCommandDeps,
  ) {}

  execute(): void {
    this.deps.patchLayer(this.layerId, this.after);
    this.deps.notifyLayerListChanged();
  }
  undo(): void {
    this.deps.patchLayer(this.layerId, this.before);
    this.deps.notifyLayerListChanged();
  }
}

export class SetLayerOpacityCommand extends PatchLayerCommand {
  readonly description = 'Change layer opacity';

  /** Merges with consecutive opacity changes on the same layer (slider drag). */
  merge(other: Command): Command | null {
    if (other instanceof SetLayerOpacityCommand && other.layerId === this.layerId) {
      return new SetLayerOpacityCommand(
        this.layerId,
        this.before,
        other.after,
        this.deps,
      );
    }
    return null;
  }
}

export class SetBlendModeCommand extends PatchLayerCommand {
  readonly description = 'Change blend mode';
}

export class SetVisibilityCommand extends PatchLayerCommand {
  readonly description = 'Toggle layer visibility';
}

export class SetLockedCommand extends PatchLayerCommand {
  readonly description = 'Toggle layer lock';
}

export class RenameLayerCommand extends PatchLayerCommand {
  readonly description: string;
  constructor(
    layerId: LayerId,
    before: { name: string },
    after: { name: string },
    deps: LayerCommandDeps,
  ) {
    super(layerId, before, after, deps);
    this.description = `Rename layer to "${after.name}"`;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Re-export for external callers building commands from the state layer. */
export type { BlendMode };
