# Pixel-Perfect Drawing Mode — Tasks

- [ ] **Task 1** — Add `pixelPerfect` to `useToolStore`
  - Files: `src/state/useToolStore.ts`
  - Add `pixelPerfect: boolean` (default `false`) and `setPixelPerfect(v: boolean): void`
  - Check: store compiles, `useToolStore.getState().pixelPerfect === false`

- [ ] **Task 2** — Expose via `ToolEngineContext`
  - Files: `src/core/ToolEngine/types.ts`, `src/state/toolBridge.ts`
  - Add `getPixelPerfect(): boolean` to `ToolEngineContext` interface
  - Wire in `toolBridge.ts` to read from `useToolStore`
  - Check: typecheck passes

- [ ] **Task 3** — Implement elbow removal in `BrushTool`
  - Files: `src/core/tools/BrushTool.ts`
  - Track `_ppHistory: [{x,y}]` (last 3 painted canvas positions, main pixel only)
  - After each `paintPixel` call, if `ctx.getPixelPerfect()` and history has ≥ 3 entries, run elbow check; if elbow found, zero the scratch pixel at p1, and either delete or restore p1's delta entry
  - Reset history on `pointerDown` / `onCancel`
  - Check: drawing a 45° diagonal with pixel-perfect ON produces no elbows; OFF is unchanged

- [ ] **Task 4** — Add toolbar toggle
  - Files: `src/ui/toolbar/ToolBar.tsx`
  - Show a pixel-perfect icon button (or "PP" text toggle) only when `activeTool === 'pencil' || activeTool === 'eraser'`
  - Binds to `useToolStore.pixelPerfect` / `setPixelPerfect`
  - Check: toggle visible on pencil/eraser, hidden on other tools; state persists while switching between pencil and eraser

- [ ] **Task 5** — Build and verify
  - Run `pnpm typecheck && pnpm build && pnpm test`
  - Draw a 45° diagonal with pixel-perfect ON — no elbows visible
  - Draw same diagonal OFF — elbows visible (no regression)
  - Undo after a pixel-perfect stroke — all pixels including removed elbows are reverted correctly
