# Lasso Tool — Tasks

- [ ] **Task 1** — Implement `LassoTool` class
  - Files: `src/core/tools/LassoTool.ts` (new)
  - Implement `onPointerDown`, `onPointerMove`, `onPointerUp`, `onCancel`
  - Path collection, scratch preview (Bresenham polyline), scanline polygon fill
  - Check: class compiles with no TS errors

- [ ] **Task 2** — Export and register
  - Files: `src/core/tools/index.ts`, `src/state/toolBridge.ts`
  - Export `LassoTool` from index; register instance in `toolBridge` alongside other tools
  - Check: typecheck passes

- [ ] **Task 3** — Toolbar button + keyboard shortcut
  - Files: `src/ui/toolbar/ToolBar.tsx`, `src/ui/canvas/CanvasViewport.tsx`
  - Add lasso button (icon: `LuLasso` from react-icons/lu) after marquee button, shortcut key `L`
  - Add `l: 'lasso'` to `TOOL_KEYS` in `CanvasViewport`
  - Check: pressing `L` activates lasso; button highlights correctly

- [ ] **Task 4** — Build and verify
  - Run `pnpm typecheck && pnpm build && pnpm test`
  - Draw a freehand loop → selection mask appears with pixel-boundary marching ants
  - Tap without dragging → no selection set
  - Escape during draw → path cancelled, no selection
  - Lasso a region then Ctrl+C / Ctrl+X → copies/cuts correct pixels
