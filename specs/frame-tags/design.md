# Frame Tags — Design

## Approach
Add a "tag row" above the frame-header row in the Timeline component. The tag row shows existing tags as colored bands and handles drag-to-create new tags. Tags are stored in `useFrameStore.tags` (already exists). Inline rename uses a controlled `<input>` rendered inside the tag band. Context menu (delete) uses a minimal local dropdown.

## Affected components

| File | Change |
|---|---|
| `src/ui/panels/Timeline/Timeline.tsx` | Add tag row rendering, drag-to-create, inline rename, right-click delete |
| `src/ui/panels/Timeline/Timeline.module.css` | Styles for tag row, tag band, inline input |
| `src/state/action-composers/tagActions.ts` | New — `createTag`, `deleteTag`, `renameTag`; also `shiftTagsForInsert` / `shiftTagsForDelete` called from frame mutation paths |
| `src/state/action-composers/frame-actions.ts` | Call `shiftTagsForInsert` / `shiftTagsForDelete` when frames are added/removed |
| `src/state/action-composers/index.ts` | Export `tagActions` |
| `src/state/action-composers/exportActions.ts` | Include tags in spritesheet JSON output |

## Data model changes
None — `Tag`, `useFrameStore.tags`, `addTag/removeTag/updateTag` already exist.

## Key flows

### Tag row layout
```
Timeline header row:
  [ tag row — full width, height ~16px ]
  [ frame header row — frame numbers + duration ]
  [ layer rows ]
```
Tag band: absolutely positioned within the tag row.
- `left = tagFromIndex * FRAME_COL_W`
- `width = (tag.to - tag.from + 1) * FRAME_COL_W`
- `background = rgba(tag.color, 0.5)` with colored left/right borders

### Drag-to-create
Track `tagDragStart: number | null` in local state.
- `onMouseDown` on tag row (not on an existing tag): set `tagDragStart = Math.floor(mouseX / FRAME_COL_W)`
- `onMouseMove` while dragging: show a draft band from `tagDragStart` to `hoverIndex`
- `onMouseUp`: `from = min(start, end)`, `to = max(start, end)`; call `tagActions.createTag({ from, to })`

### Inline rename
`editingTagId: string | null` in local state.
- Double-click on tag band → `editingTagId = tag.id`; render `<input value={tag.name} />`
- `onBlur` / `onKeyDown(Enter)` → `tagActions.renameTag(id, value)`; `editingTagId = null`

### Tag index adjustment on frame mutations
```
insertFrame(at: index):
  for each tag:
    if tag.from >= at: tag.from++; tag.to++
    elif tag.to >= at: tag.to++

deleteFrame(at: index):
  for each tag:
    if tag.from > at: tag.from--; tag.to--
    elif tag.to >= at: tag.to--
    if tag.from > tag.to: remove tag
```

### Spritesheet export
Add to the existing JSON metadata output:
```json
"tags": [{ "name": "walk", "from": 0, "to": 7, "direction": "forward" }, ...]
```

## Trade-offs
- **No drag-to-resize after creation:** keeps interaction model simple. Tags can be deleted and recreated.
- **Random color on create:** avoids a color-picker modal on every tag creation. User can't change it until we add a tag edit dialog (future). Colors drawn from a small preset palette for visual harmony.
- **Local state for drag/editing:** tag UI state is ephemeral and doesn't belong in the global store.

## Risks
- Tag positions becoming invalid after multiple frame insertions/deletions. The shift logic must be applied in all frame mutation paths. Medium risk — needs thorough testing.
