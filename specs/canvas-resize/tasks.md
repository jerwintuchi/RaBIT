# Canvas Resize — Stage 3: Tasks

## T1 — ResizeCanvasCommand
**File:** `src/core/commands/ResizeCanvasCommand.ts` (NEW)
- Implement `ResizeCanvasCommand implements Command`
- Constructor: `(opts: ResizeOpts, deps: ResizeDeps)` where opts = `{ oldW, oldH, newW, newH, mode: 'crop' | 'scale' }` and deps = store mutators
- Capture full cell snapshots (before) in constructor; compute new cells (after) on first `execute()`
- `execute()`: write new cells + call `setCanvasConfig`; `undo()`: restore old cells + `setCanvasConfig`
- `description`: `"Resize canvas ${oldW}×${oldH} → ${newW}×${newH}"`
- Acceptance: unit-testable, no React imports

**Depends on:** nothing

---

## T2 — canvasActions composer
**File:** `src/state/action-composers/canvasActions.ts` (NEW)
- `resizeCanvas(newW: number, newH: number, mode: 'crop' | 'scale'): void`
- Reads current state from `useProjectStore`, `useLayerStore`, `useFrameStore`
- Builds `ResizeCanvasCommand` with injected store mutators + `getEngine()?.invalidateLayerTexture`
- Dispatches via `useHistoryStore.getState().execute(cmd)`

**File:** `src/state/action-composers/index.ts` — add `export * as canvasActions from './canvasActions'`

**Depends on:** T1

---

## T3 — UIStore: resizeCanvasDialog slice
**File:** `src/state/useUIStore.ts`
- Add `resizeCanvasDialog: { open: boolean }` to state
- Add `showResizeCanvasDialog()` and `hideResizeCanvasDialog()` actions

**Depends on:** nothing

---

## T4 — ResizeCanvasDialog component
**Files:** `src/ui/dialogs/ResizeCanvasDialog.tsx` + `ResizeCanvasDialog.module.css` (NEW)
- Reads current canvas dimensions from `useProjectStore`
- Preset grid (same 6 presets as NewProjectDialog: 16×16 … 640×360)
- Custom W × H inputs (1–640, invalid highlight)
- Mode toggle: **Crop / Expand** (default) | **Scale**
- Scale mode: amber warning banner — "Scale resamples all pixels. Cannot be undone beyond undo history."
- Disabled Create when: dimensions unchanged OR either dim out of range
- On confirm: call `canvasActions.resizeCanvas(w, h, mode)` then `hideResizeCanvasDialog()`
- Escape / Cancel: `hideResizeCanvasDialog()`

**File:** `src/ui/dialogs/index.ts` — export `ResizeCanvasDialog`

**Depends on:** T2, T3

---

## T5 — CanvasMenu in MenuBar
**Files:** `src/ui/menu/CanvasMenu.tsx` (NEW), `src/ui/menu/MenuBar.tsx` (MODIFY), `src/ui/menu/index.ts` (MODIFY)
- `CanvasMenu`: same dropdown pattern as `FileMenu` — trigger button "Canvas", outside-click + Escape close
- Single item: "Resize Canvas…" (no shortcut for now)
- On click: `useUIStore.getState().showResizeCanvasDialog()`
- Disabled (greyed) when no project is open (`useLayerStore(s => s.layers.length === 0)`)
- Add `<CanvasMenu />` to `MenuBar.tsx` beside `<FileMenu />`

**Depends on:** T3, T4

---

## T6 — Wire ResizeCanvasDialog into App.tsx
**File:** `src/App.tsx`
- Import `ResizeCanvasDialog` from `./ui/dialogs`
- Render `<ResizeCanvasDialog />` alongside the other global dialogs in the overlay section

**Depends on:** T4, T5

---

## T7 — Verification
- `pnpm typecheck` — 0 errors
- `pnpm exec vitest run` — existing 11 tests still pass
- Manual smoke: open project → Canvas → Resize Canvas → crop to smaller size → undo → pixels restored
- Manual smoke: Scale mode → warning banner visible → confirm → all layers rescaled
- Manual smoke: no layers open → Canvas menu item is disabled
