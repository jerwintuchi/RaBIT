# Spritesheet Import — Tasks

## Task 1 — Rust `import_image` command
**Files:** `src-tauri/src/import.rs` (new)
- Create struct `ImportedImage { width: u32, height: u32, data: Vec<u8> }`
- Implement `#[tauri::command] async fn import_image(path: String) -> Result<ImportedImage, String>`
- Use `image::open(&path)?.into_rgba8()` then `.into_raw()` for data
**Acceptance:** `cargo build` passes.

## Task 2 — Register command in `lib.rs`
**Files:** `src-tauri/src/lib.rs`
- `mod import;` declaration
- Add `import::import_image` to `.invoke_handler(tauri::generate_handler![...])`
**Depends on:** Task 1
**Acceptance:** `cargo build` passes.

## Task 3 — TypeScript IPC bridge
**Files:** `src/bridge/importIpc.ts` (new)
- `export async function ipcImportImage(path: string): Promise<{ width: number; height: number; data: number[] }>`
- Calls `invoke('import_image', { path })`
**Depends on:** Task 2
**Acceptance:** `pnpm typecheck` passes.

## Task 4 — `ImportSpritesheetCommand`
**Files:** `src/core/commands/FrameCommands.ts`
- New `ImportSpritesheetCommand` that atomically:
  - Inserts N new frames (each with one cell containing sliced pixel data for the active layer)
  - `undo()` removes those frames
- Constructor takes: `frames: Array<{ id: FrameId; cell: Cell }>`, `layerId`, `insertAfterIndex`, deps
- `description = \`Import spritesheet (${n} frames)\``
**Acceptance:** `pnpm typecheck` passes.

## Task 5 — `SpritesheetImportDialog` component
**Files:** `src/ui/dialogs/SpritesheetImportDialog.tsx` (new), `SpritesheetImportDialog.module.css` (new)
- Props: `onClose(): void`
- Internal state: `imagePath`, `imageWidth`, `imageHeight`, `imageData` (raw RGBA), `cellWidth`, `cellHeight`, `mode: 'new' | 'append'`
- On mount: open Tauri file picker for PNG/BMP/WebP → `ipcImportImage(path)` → populate state
- Preview canvas: draw image scaled to fit, overlay red grid lines per cell
- Number inputs for cell width / cell height; auto-fill with `imageWidth` / `imageHeight` (i.e. single-frame default)
- Computed readout: `cols × rows = N frames`
- Radio buttons: "New project" / "Append to current" (append disabled if canvas size mismatch)
- Confirm button: disabled until valid cell size; calls `handleImport()`
**Depends on:** Task 3
**Acceptance:** Dialog renders with live grid preview; `pnpm typecheck` passes.

## Task 6 — `importSpritesheet` action
**Files:** `src/state/action-composers/file-actions.ts`
- `importSpritesheet(imageData, imgW, imgH, cellW, cellH, mode: 'new' | 'append')`
- Slices pixel data into `Uint8ClampedArray` cells (row-major order)
- If `mode === 'new'`: calls `initNewProject({ width: cellW, height: cellH })` first; uses active layer id after init
- Builds `ImportSpritesheetCommand` and dispatches via `useHistoryStore.execute()`
**Depends on:** Tasks 4, 5
**Acceptance:** `pnpm typecheck` passes.

## Task 7 — "Import Spritesheet…" in File menu
**Files:** `src/ui/menu/FileMenu.tsx`
- Add menu item "Import Spritesheet…" after "Open project"
- Clicking sets `showSpritesheetImportDialog: true` in local state → renders `<SpritesheetImportDialog onClose={() => setShow(false)} />`
**Depends on:** Task 5
**Acceptance:** Menu item visible; dialog opens and closes; `pnpm typecheck` passes.

## Task 8 — Verification
- Run `pnpm build` — 0 errors; `cargo build` — 0 errors
- Manual (requires Tauri dev mode): import a 128×32 PNG with 4 frames at 32×32 → verify 4 frames created with correct pixel content; test undo collapses back to 0 imported frames
