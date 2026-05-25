# Frame Tags — Tasks

- [ ] **Task 1** — `tagActions` action-composer
  - Files: `src/state/action-composers/tagActions.ts` (new)
  - `createTag(from, to)` — picks a color from preset palette, calls `useFrameStore.addTag`
  - `deleteTag(id)` — calls `useFrameStore.removeTag`
  - `renameTag(id, name)` — calls `useFrameStore.updateTag`
  - `shiftTagsForInsert(at)` / `shiftTagsForDelete(at)` — adjust `from`/`to` indices, remove orphaned tags
  - Check: compiles, no TS errors

- [ ] **Task 2** — Export `tagActions` from index + wire into frame-actions
  - Files: `src/state/action-composers/index.ts`, `src/state/action-composers/frame-actions.ts`
  - Export `tagActions` from index
  - Call `shiftTagsForInsert(at)` / `shiftTagsForDelete(at)` in the appropriate frame insert/delete paths
  - Check: adding/removing frames adjusts tag indices correctly

- [ ] **Task 3** — Tag row UI in Timeline
  - Files: `src/ui/panels/Timeline/Timeline.tsx`, `src/ui/panels/Timeline/Timeline.module.css`
  - Render existing tags as colored bands spanning their frame columns
  - Drag-to-create: `tagDragStart` local state, draft band preview, `createTag` on mouse-up
  - Clicking a tag band navigates to `tag.from` frame
  - Check: tags appear in timeline above frame headers; dragging creates a new tag

- [ ] **Task 4** — Inline rename + delete
  - Files: `src/ui/panels/Timeline/Timeline.tsx`
  - Double-click tag band → inline `<input>` for rename, commits on Enter/blur
  - Right-click tag band → small context menu with "Delete" option
  - Check: rename updates tag name; delete removes band from timeline

- [ ] **Task 5** — Include tags in spritesheet export JSON
  - Files: `src/state/action-composers/exportActions.ts`
  - Append `tags` array to the JSON metadata file generated alongside the spritesheet PNG
  - Check: exported JSON contains correct tag names, from/to indices, direction

- [ ] **Task 6** — Build and verify
  - Run `pnpm typecheck && pnpm build && pnpm test`
  - Create 3 tags, save project, reopen → tags persist
  - Add frame in middle of a tag → tag range expands
  - Delete a frame → tag range contracts; tags spanning only that frame are removed
  - Export spritesheet → JSON contains tags
