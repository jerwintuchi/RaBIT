# Frame Tags (Animation Ranges) — Requirements

## Problem statement
Pixel art sprites for games typically contain multiple animations packed into one file: "walk" on frames 1–8, "idle" on 9–12, "attack" on 13–18. Without named tags, the user has no way to organize or communicate these ranges within the editor, making multi-animation sprites unmanageable. Aseprite's tag system is the #1 reason game developers choose it over competitors.

The `Tag` data type, `useFrameStore.addTag/removeTag/updateTag`, and project serialization are already implemented. What's missing is the UI to create, display, edit, and delete tags in the timeline.

## User stories
- As a pixel artist, I want to drag across frames in the timeline to define a named tag range so I can label animation clips.
- As a pixel artist, I want each tag to show as a colored band above its frame range in the timeline so I can see my animation structure at a glance.
- As a pixel artist, I want to rename a tag by double-clicking it so I can fix names without a modal.
- As a pixel artist, I want to right-click a tag to delete it.
- As a pixel artist, I want to assign a color to each tag so different animations are visually distinct.
- As a pixel artist, I want tags to be saved in the `.rabit` project file so they persist across sessions (already implemented in serializer).

## Acceptance criteria
- WHEN I drag across the tag row above the frame headers THEN a new tag is created spanning those frames, with a default name "Tag N" and a randomly assigned color.
- WHEN a tag exists THEN it is rendered as a colored rounded band in the tag row spanning its frame columns.
- WHEN I double-click a tag band THEN the tag name becomes an inline editable text field; pressing Enter or blurring commits the rename.
- WHEN I right-click a tag band THEN a context menu with "Delete" appears.
- WHEN I click a tag band (without dragging) THEN the timeline jumps to that tag's first frame.
- WHEN frames are inserted or deleted THEN tags whose `from`/`to` indices are affected are adjusted to remain valid. Tags that become empty (from > to after deletion) are removed.
- WHEN I export a spritesheet THEN each tag is included in the JSON metadata as `{ name, from, to, direction }`.

## Out of scope
- Drag-to-resize tag ranges after creation.
- Tag-level playback (play only one tag's frames).
- Loop direction UI (loopDirection field exists in data model but no playback UI yet).
- Overlapping tags.

## Open questions
- None — the data model and store operations are already complete.
