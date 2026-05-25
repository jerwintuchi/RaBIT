# Outline Layer Effect — Tasks

- [ ] **Task 1** — Implement `outlineLayer()` action
  - Files: `src/state/action-composers/layerFxActions.ts` (new)
  - Scan active layer buffer, find transparent pixels 4-adjacent to opaque, build deltas, execute DrawCommand
  - Uses primary color from `useToolStore.getState().primaryColor`
  - Check: compiles, no TS errors

- [ ] **Task 2** — Export from action-composers index
  - Files: `src/state/action-composers/index.ts`
  - Export `layerFxActions` namespace
  - Check: typecheck passes

- [ ] **Task 3** — Add "Outline Layer" to Edit menu
  - Files: `src/ui/menu/EditMenu.tsx`
  - Add menu item below the flip/rotate group; disabled when no project or active layer locked
  - Check: item appears in Edit menu, disabled correctly when layer locked

- [ ] **Task 4** — Build and verify
  - Run `pnpm typecheck && pnpm build && pnpm test`
  - Paint a sprite, set primary color to black, invoke "Outline Layer" → 1px black border appears around all opaque pixels, no opaque pixels overwritten
  - Ctrl+Z → outline removed
