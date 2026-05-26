# Indexed Color Mode — Tasks

## Task 1 — `nearestSwatchColor` utility
**Files:** `src/core/DataModel/colorConversion.ts`
- Add `export function nearestSwatchColor(color: RGBA, swatches: Swatch[]): RGBA`
- Return `color` unchanged if `swatches.length === 0`
- Use Euclidean RGB distance (ignore alpha)
**Acceptance:** `pnpm typecheck` passes; unit test added in a collocated test file.

## Task 2 — `indexedMode` in palette store
**Files:** `src/state/usePaletteStore.ts`
- Add `indexedMode: boolean` (default `false`) to state
- Add `setIndexedMode(v: boolean): void` setter
**Acceptance:** `pnpm typecheck` passes.

## Task 3 — `snapColorIfIndexed` on `ToolEngineContext`
**Files:** `src/core/ToolEngine/types.ts`
- Add `snapColorIfIndexed(color: RGBA): RGBA` to the `ToolEngineContext` interface
**Acceptance:** Expect `toolBridge.ts` errors only.

## Task 4 — Implement `snapColorIfIndexed` in `toolBridge.ts`
**Files:** `src/state/toolBridge.ts`
- Read `indexedMode` and `palette.swatches` from `usePaletteStore`
- Call `nearestSwatchColor` and return result; no-op when `indexedMode === false` or swatches empty
**Depends on:** Tasks 1, 2, 3
**Acceptance:** `pnpm typecheck` passes.

## Task 5 — Snap color in `PencilTool`
**Files:** `src/core/tools/PencilTool.ts`
- In `resolvePaintColor()`, wrap result: `return this.ctx.snapColorIfIndexed(this.ctx.getPrimaryColor())`
**Depends on:** Task 4
**Acceptance:** `pnpm typecheck` passes; existing pencil tests still pass.

## Task 6 — Snap color in remaining drawing tools
**Files:** `src/core/tools/FillTool.ts`, `src/core/tools/LineTool.ts`, `src/core/tools/RectangleTool.ts`, `src/core/tools/EllipseTool.ts`
- Each tool resolves its paint color at stroke-start; wrap with `ctx.snapColorIfIndexed(color)` at that point
**Depends on:** Task 4
**Acceptance:** `pnpm typecheck` passes.

## Task 7 — `QuantizeToPaletteCommand`
**Files:** `src/core/commands/PaletteCommands.ts`
- New `QuantizeToPaletteCommand` implementing `Command`
- Constructor: `layerId`, `frameId`, `beforeData: Uint8ClampedArray`, `afterData: Uint8ClampedArray`, `deps` (canvas width + `notifyLayerChanged` callback)
- `execute()`: write `afterData` pixels to the active cell; call `notifyLayerChanged`
- `undo()`: write `beforeData`; call `notifyLayerChanged`
- `description = 'Quantize to palette'`
**Acceptance:** `pnpm typecheck` passes.

## Task 8 — `quantizeToPalette` action-composer
**Files:** `src/state/action-composers/index.ts` (or a new `paletteActions.ts`)
- Read active layer, active frame cell, palette swatches
- Build `afterData` by cloning the cell buffer and remapping each non-transparent pixel with `nearestSwatchColor`
- Dispatch `QuantizeToPaletteCommand` via `useHistoryStore.execute()`
**Depends on:** Task 7
**Acceptance:** `pnpm typecheck` passes.

## Task 9 — Indexed mode toggle in Palette Panel
**Files:** `src/ui/panels/PalettePanel/PalettePanel.tsx`
- Add a small toggle button (labelled "IDX" or an index icon) in the palette panel header
- Clicking calls `usePaletteStore.getState().setIndexedMode(!indexedMode)`
- Button has active/inactive visual state
**Depends on:** Task 2
**Acceptance:** Toggle button visible; clicking changes store state.

## Task 10 — Warning indicator in color well
**Files:** `src/ui/panels/ColorPickerPanel/ColorWells.tsx`
- Subscribe to `usePaletteStore` for `indexedMode`, `palette.swatches`, `primaryColor`
- When `indexedMode === true` and `primaryColor` has no exact swatch match, render a small yellow `⚠` badge overlaid on the primary color well
**Depends on:** Task 2
**Acceptance:** Badge appears/disappears correctly; `pnpm typecheck` passes.

## Task 11 — "Quantize to palette" in Edit menu
**Files:** `src/ui/menu/EditMenu.tsx`
- Add menu item "Quantize to palette" calling the action from Task 8
- Disabled when no active layer or palette is empty
**Depends on:** Task 8
**Acceptance:** Menu item visible and functional; `pnpm typecheck` passes.

## Task 12 — Verification
- Run `pnpm build` — 0 errors
- Run `pnpm test` — all pass
- Manual: enable indexed mode, paint with a non-palette color, verify color snaps; invoke quantize, verify undo restores original pixels
