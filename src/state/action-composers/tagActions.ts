import { makeTag } from '../../core/DataModel';
import type { TagId } from '../../core/DataModel';
import { useFrameStore } from '../useFrameStore';

// A small preset of visually distinct tag colors (packed RGBA).
const TAG_COLORS = [
  0xff6b6bff, // red
  0x6bcbffff, // blue
  0x6bff9aff, // green
  0xffd56bff, // yellow
  0xd46bffff, // purple
  0xff9f6bff, // orange
  0x6bffe8ff, // teal
  0xff6bc4ff, // pink
];

let _tagColorIndex = 0;
function nextTagColor(): number {
  const color = TAG_COLORS[_tagColorIndex % TAG_COLORS.length]!;
  _tagColorIndex++;
  return color;
}

/** Create a new tag spanning [from, to] (inclusive). */
export function createTag(from: number, to: number): void {
  const tag = makeTag(Math.min(from, to), Math.max(from, to), {
    color: nextTagColor(),
  });
  useFrameStore.getState().addTag(tag);
}

/** Delete an existing tag by ID. */
export function deleteTag(id: TagId): void {
  useFrameStore.getState().removeTag(id);
}

/** Rename an existing tag. */
export function renameTag(id: TagId, name: string): void {
  useFrameStore.getState().updateTag(id, { name });
}

/**
 * Adjust all tag indices when a frame is inserted at `at`.
 * Called automatically by frame-actions after every frame insertion.
 */
export function shiftTagsForInsert(at: number): void {
  const { tags } = useFrameStore.getState();
  for (const tag of tags) {
    if (tag.from >= at) {
      useFrameStore.getState().updateTag(tag.id, { from: tag.from + 1, to: tag.to + 1 });
    } else if (tag.to >= at) {
      useFrameStore.getState().updateTag(tag.id, { to: tag.to + 1 });
    }
  }
}

/**
 * Adjust all tag indices when a frame is deleted at `at`.
 * Tags that shrink to zero width are removed.
 * Called automatically by frame-actions after every frame deletion.
 */
export function shiftTagsForDelete(at: number): void {
  const { tags } = useFrameStore.getState();
  for (const tag of tags) {
    if (tag.from > at) {
      useFrameStore.getState().updateTag(tag.id, { from: tag.from - 1, to: tag.to - 1 });
    } else if (tag.to >= at) {
      const newTo = tag.to - 1;
      if (tag.from > newTo) {
        useFrameStore.getState().removeTag(tag.id);
      } else {
        useFrameStore.getState().updateTag(tag.id, { to: newTo });
      }
    }
  }
}
