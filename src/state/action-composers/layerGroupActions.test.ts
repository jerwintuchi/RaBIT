/**
 * Unit tests for M16 layer-group action-composers:
 * addGroup, addLayer (group context), removeLayer (cascade), moveLayerToGroup,
 * moveLayerOutOfGroup, toggleGroupCollapsed.
 *
 * Uses real Zustand stores in-memory; mocks only GPU/Tauri side-effects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addGroup,
  addLayer,
  duplicateLayer,
  removeLayer,
  moveLayerToGroup,
  moveLayerOutOfGroup,
  toggleGroupCollapsed,
} from './layer-actions';
import { useLayerStore } from '../useLayerStore';
import { useFrameStore } from '../useFrameStore';
import { useProjectStore } from '../useProjectStore';
import { useHistoryStore } from '../useHistoryStore';
import type { Layer } from '../dataModelTypes';

vi.mock('../renderBridge', () => ({
  uploadLayerData: vi.fn(),
  getEngine: vi.fn(() => ({
    setLayers: vi.fn(),
    markDirty: vi.fn(),
  })),
  DirtyFlag: { LAYER_DATA: 1, LAYER_ORDER: 2, FULL: 4 },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeLayer(overrides: Partial<Layer> & { id: string; name: string }): Layer {
  return {
    type: 'layer',
    parentGroupId: null,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    ...overrides,
  };
}

function setupStores(layers: Layer[], activeLayerId?: string) {
  useLayerStore.setState({
    layers,
    activeLayerId: activeLayerId ?? layers[0]?.id ?? null,
    dataVersions: Object.fromEntries(layers.map((l) => [l.id, 0])),
  });
  useFrameStore.setState({
    frames: [{ id: 'f1', duration: 100, cells: {}, hiddenLayerIds: [] }],
    activeFrameIndex: 0,
    tags: [],
    playback: { playing: false, fps: 12, loop: true },
  });
  useProjectStore.setState((s) => ({
    ...s,
    canvas: { ...s.canvas, width: 4, height: 4 },
  }));
  useHistoryStore.getState().clear();
}

function layers() {
  return useLayerStore.getState().layers;
}

// ── addGroup ──────────────────────────────────────────────────────────────────

describe('addGroup', () => {
  beforeEach(() => setupStores([makeLayer({ id: 'l1', name: 'Layer 1' })]));

  it('inserts a group layer with type=group', () => {
    addGroup('My Group');
    const ls = layers();
    const group = ls.find((l) => l.type === 'group');
    expect(group).toBeDefined();
    expect(group?.name).toBe('My Group');
    expect(group?.parentGroupId).toBeNull();
  });

  it('inserts the group at the top of the stack (end of array)', () => {
    addGroup();
    const ls = layers();
    expect(ls[ls.length - 1]?.type).toBe('group');
  });

  it('is undoable — undo removes the group', () => {
    addGroup();
    expect(layers().some((l) => l.type === 'group')).toBe(true);
    useHistoryStore.getState().undo();
    expect(layers().some((l) => l.type === 'group')).toBe(false);
  });

  it('redo re-adds the group', () => {
    addGroup();
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();
    expect(layers().some((l) => l.type === 'group')).toBe(true);
  });
});

// ── addLayer with group context ───────────────────────────────────────────────

describe('addLayer — explicit inGroupId', () => {
  it('sets parentGroupId on the new layer', () => {
    const group = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1, group], l1.id);

    addLayer(undefined, group.id);
    const newLayer = layers().find((l) => l.id !== 'g1' && l.id !== 'l1');
    expect(newLayer?.parentGroupId).toBe('g1');
  });

  it('inserts the child at the group\'s array index (just before the group)', () => {
    const group = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    // array: [l1, group]
    setupStores([l1, group], l1.id);

    addLayer(undefined, group.id);
    // expected array: [l1, newChild, group]
    const ls = layers();
    const groupIdx = ls.findIndex((l) => l.id === 'g1');
    const childIdx = ls.findIndex((l) => l.parentGroupId === 'g1');
    expect(childIdx).toBeGreaterThanOrEqual(0);
    expect(childIdx).toBeLessThan(groupIdx);
  });

  it('is undoable', () => {
    const group = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    setupStores([makeLayer({ id: 'l1', name: 'Layer 1' }), group], 'l1');

    addLayer(undefined, group.id);
    const countBefore = layers().length;
    useHistoryStore.getState().undo();
    expect(layers().length).toBe(countBefore - 1);
    expect(layers().some((l) => l.parentGroupId === 'g1')).toBe(false);
  });
});

describe('addLayer — active layer is a group (auto-detect)', () => {
  it('new layer joins the active group', () => {
    const group = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1, group], group.id); // group is active

    addLayer();
    const newLayer = layers().find((l) => l.id !== 'g1' && l.id !== 'l1');
    expect(newLayer?.parentGroupId).toBe('g1');
  });
});

describe('addLayer — active layer is a child (auto-detect parent)', () => {
  it('new layer joins the same parent group', () => {
    const group = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const child = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1, child, group], child.id); // child is active

    addLayer();
    const newLayer = layers().find((l) => l.id !== 'g1' && l.id !== 'c1' && l.id !== 'l1');
    expect(newLayer?.parentGroupId).toBe('g1');
  });
});

describe('addLayer — no group context', () => {
  it('inserts at root level (parentGroupId null)', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1], l1.id);

    addLayer();
    const newLayer = layers().find((l) => l.id !== 'l1');
    expect(newLayer?.parentGroupId).toBeNull();
  });

  it('inserts at top of the stack (end of array)', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1], l1.id);

    addLayer();
    const ls = layers();
    expect(ls[ls.length - 1]?.id).not.toBe('l1');
    expect(ls[ls.length - 1]?.parentGroupId).toBeNull();
  });
});

// ── removeLayer — cascade on group ────────────────────────────────────────────

describe('removeLayer — group cascade', () => {
  it('removes the group and all its children', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child 1', parentGroupId: 'g1' });
    const c2 = makeLayer({ id: 'c2', name: 'Child 2', parentGroupId: 'g1' });
    setupStores([l1, c1, c2, g1], l1.id);

    removeLayer('g1');
    const ids = layers().map((l) => l.id);
    expect(ids).not.toContain('g1');
    expect(ids).not.toContain('c1');
    expect(ids).not.toContain('c2');
    expect(ids).toContain('l1');
  });

  it('cascade delete is undoable — restores group and all children', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    setupStores([l1, c1, g1], l1.id);

    removeLayer('g1');
    expect(layers().length).toBe(1);

    useHistoryStore.getState().undo();
    const ids = layers().map((l) => l.id);
    expect(ids).toContain('g1');
    expect(ids).toContain('c1');
  });

  it('refuses to remove a group when that would leave no regular layers', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    // Only regular layer is c1 — removing g1 would also remove c1 → refuse
    setupStores([c1, g1], c1.id);

    removeLayer('g1');
    expect(layers().some((l) => l.id === 'g1')).toBe(true);
  });
});

describe('removeLayer — regular layer', () => {
  it('refuses to remove the last regular layer', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1], l1.id);

    removeLayer('l1');
    expect(layers().length).toBe(1);
  });

  it('removes a regular layer when others exist', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const l2 = makeLayer({ id: 'l2', name: 'Layer 2' });
    setupStores([l1, l2], l1.id);

    removeLayer('l1');
    expect(layers().map((l) => l.id)).not.toContain('l1');
  });
});

// ── moveLayerToGroup / moveLayerOutOfGroup ────────────────────────────────────

describe('moveLayerToGroup', () => {
  it('sets parentGroupId on the layer', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    setupStores([l1, g1], l1.id);

    moveLayerToGroup('l1', 'g1');
    expect(layers().find((l) => l.id === 'l1')?.parentGroupId).toBe('g1');
  });

  it('is undoable', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    setupStores([l1, g1], l1.id);

    moveLayerToGroup('l1', 'g1');
    useHistoryStore.getState().undo();
    expect(layers().find((l) => l.id === 'l1')?.parentGroupId).toBeNull();
  });

  it('no-ops when layer is already in that group', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1', parentGroupId: 'g1' });
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    setupStores([l1, g1], l1.id);

    moveLayerToGroup('l1', 'g1');
    expect(useHistoryStore.getState().undoCount).toBe(0);
  });
});

describe('moveLayerOutOfGroup', () => {
  it('clears parentGroupId', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    setupStores([c1, g1], c1.id);

    moveLayerOutOfGroup('c1');
    expect(layers().find((l) => l.id === 'c1')?.parentGroupId).toBeNull();
  });

  it('is undoable', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    setupStores([c1, g1], c1.id);

    moveLayerOutOfGroup('c1');
    useHistoryStore.getState().undo();
    expect(layers().find((l) => l.id === 'c1')?.parentGroupId).toBe('g1');
  });

  it('no-ops when layer has no group', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1], l1.id);

    moveLayerOutOfGroup('l1');
    expect(useHistoryStore.getState().undoCount).toBe(0);
  });
});

// ── toggleGroupCollapsed ──────────────────────────────────────────────────────

describe('toggleGroupCollapsed', () => {
  it('sets collapsed=true on an expanded group', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    setupStores([g1], g1.id);

    toggleGroupCollapsed('g1');
    expect(layers().find((l) => l.id === 'g1')?.collapsed).toBe(true);
  });

  it('sets collapsed=false on an already-collapsed group', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group', collapsed: true });
    setupStores([g1], g1.id);

    toggleGroupCollapsed('g1');
    expect(layers().find((l) => l.id === 'g1')?.collapsed).toBe(false);
  });

  it('no-ops on a non-group layer', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1], l1.id);

    toggleGroupCollapsed('l1');
    // Layer should be unchanged (no collapsed property added)
    expect(layers().find((l) => l.id === 'l1')?.collapsed).toBeUndefined();
  });
});

// ── regression: Bug 1 — undo order in RemoveGroupWithMembersCommand ───────────

describe('removeLayer group — undo restores correct array order', () => {
  it('restores children at lower indices than the group after undo', () => {
    // array: [l1(0), c1(1), c2(2), g1(3), l2(4)]
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child 1', parentGroupId: 'g1' });
    const c2 = makeLayer({ id: 'c2', name: 'Child 2', parentGroupId: 'g1' });
    const l2 = makeLayer({ id: 'l2', name: 'Layer 2' });
    setupStores([l1, c1, c2, g1, l2], l1.id);

    const beforeIds = layers().map((l) => l.id);
    removeLayer('g1');

    useHistoryStore.getState().undo();

    // Exact order must be restored
    expect(layers().map((l) => l.id)).toEqual(beforeIds);

    // Children must be at lower indices than the group (invariant)
    const ls = layers();
    const gIdx = ls.findIndex((l) => l.id === 'g1');
    const c1Idx = ls.findIndex((l) => l.id === 'c1');
    const c2Idx = ls.findIndex((l) => l.id === 'c2');
    expect(c1Idx).toBeLessThan(gIdx);
    expect(c2Idx).toBeLessThan(gIdx);
  });
});

// ── regression: Bug 3 — duplicateLayer preserves parentGroupId ────────────────

describe('duplicateLayer — group membership', () => {
  it('duplicate of a child layer keeps the same parentGroupId', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1, c1, g1], c1.id);

    duplicateLayer('c1');
    const dup = layers().find((l) => l.id !== 'g1' && l.id !== 'c1' && l.id !== 'l1');
    expect(dup).toBeDefined();
    expect(dup?.parentGroupId).toBe('g1');
  });

  it('duplicate of a root-level layer has null parentGroupId', () => {
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    const l2 = makeLayer({ id: 'l2', name: 'Layer 2' });
    setupStores([l1, l2], l1.id);

    duplicateLayer('l1');
    const dup = layers().find((l) => l.id !== 'l1' && l.id !== 'l2');
    expect(dup?.parentGroupId).toBeNull();
  });

  it('duplicate child stays at lower array index than its group', () => {
    const g1 = makeLayer({ id: 'g1', name: 'Group', type: 'group' });
    const c1 = makeLayer({ id: 'c1', name: 'Child', parentGroupId: 'g1' });
    const l1 = makeLayer({ id: 'l1', name: 'Layer 1' });
    setupStores([l1, c1, g1], c1.id);

    duplicateLayer('c1');
    const ls = layers();
    const gIdx = ls.findIndex((l) => l.id === 'g1');
    const dupIdx = ls.findIndex((l) => l.id !== 'g1' && l.id !== 'c1' && l.id !== 'l1');
    expect(dupIdx).toBeLessThan(gIdx);
  });
});
