/**
 * Unit tests for tagActions: createTag, deleteTag, renameTag,
 * shiftTagsForInsert, shiftTagsForDelete.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTag,
  deleteTag,
  renameTag,
  shiftTagsForInsert,
  shiftTagsForDelete,
} from './tagActions';
import { useFrameStore } from '../useFrameStore';
import { makeTag } from '../../core/DataModel';

function resetStore(): void {
  useFrameStore.setState({
    frames: [],
    activeFrameIndex: 0,
    tags: [],
    playback: { playing: false, fps: 12, loop: true },
  });
}

beforeEach(resetStore);

// ── createTag ─────────────────────────────────────────────────────────────────

describe('createTag', () => {
  it('adds a tag with the given from/to range', () => {
    createTag(2, 5);
    const { tags } = useFrameStore.getState();
    expect(tags).toHaveLength(1);
    expect(tags[0]!.from).toBe(2);
    expect(tags[0]!.to).toBe(5);
  });

  it('normalizes inverted ranges (from > to)', () => {
    createTag(5, 2);
    const { tags } = useFrameStore.getState();
    expect(tags[0]!.from).toBe(2);
    expect(tags[0]!.to).toBe(5);
  });

  it('assigns a non-zero color', () => {
    createTag(0, 3);
    expect(useFrameStore.getState().tags[0]!.color).not.toBe(0);
  });

  it('creates a single-frame tag (from === to)', () => {
    createTag(3, 3);
    const { tags } = useFrameStore.getState();
    expect(tags[0]!.from).toBe(3);
    expect(tags[0]!.to).toBe(3);
  });
});

// ── deleteTag ─────────────────────────────────────────────────────────────────

describe('deleteTag', () => {
  it('removes the tag with the given id', () => {
    createTag(0, 2);
    const id = useFrameStore.getState().tags[0]!.id;
    deleteTag(id);
    expect(useFrameStore.getState().tags).toHaveLength(0);
  });

  it('does not affect other tags', () => {
    createTag(0, 2);
    createTag(4, 6);
    const id1 = useFrameStore.getState().tags[0]!.id;
    deleteTag(id1);
    expect(useFrameStore.getState().tags).toHaveLength(1);
    expect(useFrameStore.getState().tags[0]!.from).toBe(4);
  });
});

// ── renameTag ─────────────────────────────────────────────────────────────────

describe('renameTag', () => {
  it('updates the tag name', () => {
    createTag(0, 4);
    const id = useFrameStore.getState().tags[0]!.id;
    renameTag(id, 'walk');
    expect(useFrameStore.getState().tags[0]!.name).toBe('walk');
  });
});

// ── shiftTagsForInsert ────────────────────────────────────────────────────────

describe('shiftTagsForInsert', () => {
  it('shifts a tag fully after the insert point by 1', () => {
    // Tag at [3,5]; insert at 2 → tag shifts to [4,6]
    useFrameStore.getState().addTag(makeTag(3, 5));
    shiftTagsForInsert(2);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(4);
    expect(tag.to).toBe(6);
  });

  it('extends a tag that spans the insert point (to++, from unchanged)', () => {
    // Tag at [1,4]; insert at 3 → tag becomes [1,5]
    useFrameStore.getState().addTag(makeTag(1, 4));
    shiftTagsForInsert(3);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(1);
    expect(tag.to).toBe(5);
  });

  it('shifts a tag whose from === insert point', () => {
    // Tag at [3,5]; insert at 3 → tag shifts to [4,6]
    useFrameStore.getState().addTag(makeTag(3, 5));
    shiftTagsForInsert(3);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(4);
    expect(tag.to).toBe(6);
  });

  it('leaves tags entirely before the insert point unchanged', () => {
    // Tag at [0,1]; insert at 3 → no change
    useFrameStore.getState().addTag(makeTag(0, 1));
    shiftTagsForInsert(3);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(0);
    expect(tag.to).toBe(1);
  });
});

// ── shiftTagsForDelete ────────────────────────────────────────────────────────

describe('shiftTagsForDelete', () => {
  it('shifts a tag fully after the deleted frame by 1', () => {
    // Tag at [3,5]; delete frame 1 → tag shifts to [2,4]
    useFrameStore.getState().addTag(makeTag(3, 5));
    shiftTagsForDelete(1);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(2);
    expect(tag.to).toBe(4);
  });

  it('shrinks a tag whose to === deleted frame (to--)', () => {
    // Tag at [1,3]; delete frame 3 → tag becomes [1,2]
    useFrameStore.getState().addTag(makeTag(1, 3));
    shiftTagsForDelete(3);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(1);
    expect(tag.to).toBe(2);
  });

  it('shrinks a tag spanning the deleted frame (interior delete)', () => {
    // Tag at [1,5]; delete frame 3 → tag becomes [1,4]
    useFrameStore.getState().addTag(makeTag(1, 5));
    shiftTagsForDelete(3);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(1);
    expect(tag.to).toBe(4);
  });

  it('removes a single-frame tag when its only frame is deleted', () => {
    // Tag at [3,3]; delete frame 3 → tag removed (from > to after adjustment)
    useFrameStore.getState().addTag(makeTag(3, 3));
    shiftTagsForDelete(3);
    expect(useFrameStore.getState().tags).toHaveLength(0);
  });

  it('leaves tags entirely before the deleted frame unchanged', () => {
    // Tag at [0,1]; delete frame 4 → no change
    useFrameStore.getState().addTag(makeTag(0, 1));
    shiftTagsForDelete(4);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(0);
    expect(tag.to).toBe(1);
  });

  it('handles from > deleted frame: shifts both', () => {
    // Tag at [5,8]; delete frame 2 → shifts to [4,7]
    useFrameStore.getState().addTag(makeTag(5, 8));
    shiftTagsForDelete(2);
    const tag = useFrameStore.getState().tags[0]!;
    expect(tag.from).toBe(4);
    expect(tag.to).toBe(7);
  });
});
