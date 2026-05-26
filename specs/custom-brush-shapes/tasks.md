# Custom Brush Shapes — Tasks

## Task 1 — Add `BrushShape` type
**Files:** `src/core/DataModel/types.ts`
- Add `export type BrushShape = 'square' | 'round';`
**Acceptance:** `pnpm typecheck` passes.

## Task 2 — Extend tool options with `brushShape`
**Files:** `src/state/useToolStore.ts`
- Add `brushShape: BrushShape` to `PencilOptions` (default `'square'`)
- Add `brushShape: BrushShape` to `EraserOptions` (default `'square'`)
- Update `defaultOptions` accordingly
**Depends on:** Task 1
**Acceptance:** `pnpm typecheck` passes.

## Task 3 — Add `getBrushOptions()` to `ToolEngineContext`
**Files:** `src/core/ToolEngine/types.ts`
- Add `getBrushOptions(): { size: number; shape: BrushShape }` to the `ToolEngineContext` interface
**Depends on:** Task 1
**Acceptance:** `pnpm typecheck` — expect errors in `toolBridge.ts` (not yet implemented); rest passes.

## Task 4 — Implement `getBrushOptions()` in `toolBridge.ts`
**Files:** `src/state/toolBridge.ts`
- Read `activeTool`, `options.pencil.size`, `options.pencil.brushShape` (or eraser equivalent) from `useToolStore`
- Return `{ size, shape }` — use size=1/shape='square' for tools that aren't pencil/eraser
**Depends on:** Task 3
**Acceptance:** `pnpm typecheck` passes with no errors.

## Task 5 — Multi-pixel `paintFootprint` in `BrushTool`
**Files:** `src/core/tools/BrushTool.ts`
- Add `private offsets: Array<{dx: number; dy: number}> = []` field
- Add `private computeOffsets(size: number, shape: BrushShape): void` — populate `this.offsets` using the square/round formulas from the design doc
- In `onPointerDown`, call `computeOffsets(ctx.getBrushOptions().size, ctx.getBrushOptions().shape)` after resolving layer
- Replace the single `this.paintPixel(e.canvasX, e.canvasY)` call with `this.paintFootprint(e.canvasX, e.canvasY)`
- Add `private paintFootprint(cx: number, cy: number): void` — iterate `this.offsets` and call `this.paintPixel(cx+dx, cy+dy)` for each
- In `plotLine`, replace the `this.paintPixel(x, y)` call with `this.paintFootprint(x, y)`
- Disable pixel-perfect elbow detection when `offsets.length > 1`
**Depends on:** Task 4
**Acceptance:** `pnpm typecheck` passes; existing `brushTool.test.ts` still passes.

## Task 6 — Brush options strip in ToolBar
**Files:** `src/ui/toolbar/ToolBar.tsx`
- When `activeTool === 'pencil'` or `'eraser'`, render an options strip below the toolbar with:
  - Size chips: 1, 2, 3, 5, 7, 9, 13, 16 — clicking calls `updateOptions(activeTool, { size: n })`
  - Shape toggle (square / round) — clicking calls `updateOptions(activeTool, { brushShape: s })`
  - Hide shape toggle and force size=1 when `pixelPerfect` is true (pencil only)
**Depends on:** Task 2
**Acceptance:** UI renders; clicking chips updates the store; `pnpm typecheck` passes.

## Task 7 — Brush cursor overlay
**Files:** `src/ui/canvas/CanvasViewport.tsx`, `src/ui/canvas/CanvasViewport.module.css`
- Add a `<canvas ref={cursorCanvasRef}>` absolutely positioned over the WebGL canvas with `pointer-events: none`
- On `onMouseMove` over the canvas, clear the overlay and draw a 1px outline rectangle (or circle for round shape) scaled by the current zoom level, centered on the cursor canvas-pixel position
- Set `cursor: none` on the WebGL canvas when pencil/eraser is active and brush size > 1
- Update the overlay when tool options change (subscribe to `useToolStore`)
**Depends on:** Task 6
**Acceptance:** Cursor preview renders correctly at different zoom levels; reverts to crosshair for other tools.

## Task 8 — `[` / `]` size shortcuts
**Files:** `src/state/usePrefsStore.ts`, `src/ui/canvas/useViewportInteraction.ts`
- Add `'brush.sizeDecrease': '['` and `'brush.sizeIncrease': ']'` to `DEFAULT_KEYBINDINGS`
- In `useViewportInteraction.ts` `onKeyDown`, when pencil or eraser is active and the shortcut fires, call `updateOptions(activeTool, { size: clamp(size ± 1, 1, 16) })`
- Guard with `!isTypingTarget()`
**Depends on:** Task 2
**Acceptance:** `[` and `]` adjust brush size in-app; `pnpm typecheck` passes.

## Task 9 — Verification
- Run `pnpm build` — must pass with 0 errors
- Run `pnpm test` — all existing tests pass
- Manual: paint with size 5 round brush, check footprint matches shape; check cursor overlay; check `[`/`]` adjust size; check pixel-perfect mode disables multi-pixel
