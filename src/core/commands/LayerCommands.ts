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

// ── Merge down ─────────────────────────────────────────────────────────────

/**
 * Composites the upper layer onto the lower layer for every frame, then
 * removes the upper layer. Fully reversible: undo restores both layers' cells
 * and re-inserts the upper layer at its original index.
 */
export class MergeDownCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    /** The upper (active) layer that will be removed. */
    private readonly upperLayer: Layer,
    /** The lower (target) layer whose cells will receive the composite. */
    private readonly lowerLayer: Layer,
    /** Index of upperLayer in layers[] before merge. */
    private readonly upperIndex: number,
    /** Map of frameId → new composited cell for lowerLayer. */
    private readonly mergedCells: Map<FrameId, Cell>,
    /** Original cells of lowerLayer before merge (for undo). */
    private readonly lowerOriginalCells: Map<FrameId, Cell>,
    /** Original cells of upperLayer (for undo). */
    private readonly upperOriginalCells: Map<FrameId, Cell>,
    private readonly priorActiveLayerId: LayerId | null,
    private readonly deps: LayerCommandDeps,
  ) {
    this.description = `Merge down "${upperLayer.name}" → "${lowerLayer.name}"`;
  }

  execute(): void {
    // Write composited data into lower layer cells
    for (const [frameId, cell] of this.mergedCells) {
      this.deps.setCell(frameId, this.lowerLayer.id, cell);
    }
    // Remove upper layer and its cells
    for (const frameId of this.upperOriginalCells.keys()) {
      this.deps.removeCell(frameId, this.upperLayer.id);
    }
    this.deps.removeLayer(this.upperLayer.id);
    this.deps.invalidateLayerTexture(this.upperLayer.id);
    this.deps.setActiveLayer(this.lowerLayer.id);
    this.deps.notifyLayerListChanged();
  }

  undo(): void {
    // Restore lower layer's original cells
    for (const [frameId, cell] of this.lowerOriginalCells) {
      this.deps.setCell(frameId, this.lowerLayer.id, cell);
    }
    // Re-insert upper layer at its original index with its original cells
    this.deps.insertLayer(this.upperLayer, this.upperIndex);
    for (const [frameId, cell] of this.upperOriginalCells) {
      this.deps.setCell(frameId, this.upperLayer.id, cell);
    }
    this.deps.setActiveLayer(this.priorActiveLayerId);
    this.deps.notifyLayerListChanged();
  }
}

// ── Group ──────────────────────────────────────────────────────────────────

/** Adds a group layer (no pixel data). Undo removes it. */
export class AddGroupCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly group: Layer,
    private readonly insertAtIndex: number,
    private readonly priorActiveLayerId: LayerId | null,
    private readonly deps: LayerCommandDeps,
  ) {
    this.description = `Add group "${group.name}"`;
  }

  execute(): void {
    this.deps.insertLayer(this.group, this.insertAtIndex);
    this.deps.setActiveLayer(this.group.id);
    this.deps.notifyLayerListChanged();
  }

  undo(): void {
    this.deps.removeLayer(this.group.id);
    this.deps.setActiveLayer(this.priorActiveLayerId);
    this.deps.notifyLayerListChanged();
  }
}

/**
 * Removes a group layer and all its member layers in one undoable step.
 * Members are captured with their cells by the action-composer before issuing.
 */
export class RemoveGroupWithMembersCommand implements Command {
  readonly id = nanoid(12);
  readonly description: string;

  constructor(
    private readonly group: Layer,
    private readonly groupIndex: number,
    /** Members sorted by ascending layer index — order is important for undo reinsertion. */
    private readonly members: Array<{
      layer: Layer;
      index: number;
      cellsByFrame: Map<FrameId, Cell>;
    }>,
    private readonly priorActiveLayerId: LayerId | null,
    private readonly nextActiveLayerId: LayerId | null,
    private readonly deps: LayerCommandDeps,
  ) {
    this.description = `Delete group "${group.name}"`;
  }

  execute(): void {
    // Remove members in reverse index order so lower indices stay stable
    for (const { layer, cellsByFrame } of [...this.members].reverse()) {
      for (const frameId of cellsByFrame.keys()) {
        this.deps.removeCell(frameId, layer.id);
      }
      this.deps.removeLayer(layer.id);
      this.deps.invalidateLayerTexture(layer.id);
    }
    this.deps.removeLayer(this.group.id);
    this.deps.setActiveLayer(this.nextActiveLayerId);
    this.deps.notifyLayerListChanged();
  }

  undo(): void {
    // Members are at lower array indices than the group (invariant).
    // Re-insert members first in ascending index order so their insertions
    // don't shift the group's slot, then restore the group.
    for (const { layer, index, cellsByFrame } of this.members) {
      this.deps.insertLayer(layer, index);
      for (const [frameId, cell] of cellsByFrame) {
        this.deps.setCell(frameId, layer.id, cell);
      }
    }
    this.deps.insertLayer(this.group, this.groupIndex);
    this.deps.setActiveLayer(this.priorActiveLayerId);
    this.deps.notifyLayerListChanged();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Re-export for external callers building commands from the state layer. */
export type { BlendMode };
