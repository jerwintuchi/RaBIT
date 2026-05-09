# M11 — PNG + Spritesheet Export — Stage 3: Tasks

## Task List

- [ ] **T1 — Add `png` crate to Cargo.toml**
  - File: `src-tauri/Cargo.toml`
  - Add: `png = "0.17"`
  - Check: `cargo check` passes

- [ ] **T2 — `src-tauri/src/export/dto.rs`**
  - New file: `FrameSelection`, `PngExportOptions`, `SheetLayout`, `SpritesheetExportOptions`, `ExportResult`, `ExportProgress` structs
  - All derive `Serialize`, `Deserialize`, `Clone`
  - Check: `cargo check` passes

- [ ] **T3 — `src-tauri/src/export/composite.rs`**
  - New file: `resolve_cell`, `composite_frame`, `blend_pixel` (all 6 modes), `apply_opacity`, `upscale`
  - Dependencies: `crate::project_io::dto::{ProjectDto, FrameDto, LayerDto, CellDto}`
  - Check: `cargo check` passes; unit tests for blend_pixel (normal, multiply, transparent src)

- [ ] **T4 — `src-tauri/src/export/encode.rs`**
  - New file: `encode_png(pixels: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String>`
  - Uses `png` crate; writes RGBA 8-bit with `tEXt` chunk `Software = "RaBIT 0.1.0"`
  - Check: `cargo check` passes; unit test: encode 1×1 red pixel, verify PNG magic bytes

- [ ] **T5 — `src-tauri/src/export/spritesheet.rs`**
  - New file: `compute_layout`, `blit_frame`, `build_sheet`, `build_sidecar_json`
  - Supports Horizontal / Vertical / Grid layouts with padding
  - Sidecar JSON assembled as `serde_json::Value`, written with `serde_json::to_writer_pretty`
  - Check: `cargo check` passes

- [ ] **T6 — `src-tauri/src/export/commands.rs`**
  - New file: `export_png` and `export_spritesheet` Tauri commands
  - Both run in `tauri::async_runtime::spawn`; emit `export:progress` events; validate paths via `fs_sandbox::safe_write_path`
  - Check: `cargo check` passes

- [ ] **T7 — `src-tauri/src/export/mod.rs` + register in `lib.rs`**
  - `mod.rs`: re-exports `commands::{export_png, export_spritesheet}`
  - `lib.rs`: add `mod export;`, import 2 commands, add to `invoke_handler!`
  - Check: `cargo check` passes

- [ ] **T8 — `src/bridge/exportIpc.ts`**
  - New file: TypeScript mirrors of all export DTOs; `ipcExportPng`, `ipcExportSpritesheet` wrappers; `listenExportProgress` event listener
  - Check: `pnpm typecheck` passes

- [ ] **T9 — Add `exportDialog` to `useUIStore.ts`**
  - Add: `exportDialog: { open: boolean }` state + `showExportDialog()` + `hideExportDialog()` actions
  - Check: `pnpm typecheck` passes

- [ ] **T10 — `src/state/action-composers/exportActions.ts`**
  - New file: `exportPng(options)` and `exportSpritesheet(options)` — snapshot project, invoke IPC, handle progress, show toast on completion/error
  - `src/state/action-composers/index.ts`: add `export * as exportActions`
  - Check: `pnpm typecheck` passes

- [ ] **T11 — `src/ui/dialogs/ExportDialog.tsx` + `ExportDialog.module.css`**
  - Two-tab modal: PNG Frames tab + Spritesheet tab
  - PNG tab: frame selection (current/all), scale button group, include-background toggle, output dir picker
  - Spritesheet tab: layout radio (H/V/Grid + column count), padding input, scale, include-background, sidecar JSON toggle, output file picker
  - Footer: progress bar (hidden until export starts), Export + Cancel buttons
  - `src/ui/dialogs/index.ts`: export `ExportDialog`
  - Check: `pnpm typecheck` passes

- [ ] **T12 — Wire `FileMenu.tsx` + `App.tsx`**
  - `FileMenu.tsx`: add "Export…" menu item with Ctrl+E shortcut hint; calls `useUIStore.getState().showExportDialog()`
  - `App.tsx`: add Ctrl+E keyboard shortcut handler; mount `<ExportDialog />` in editor layout overlays
  - Check: `pnpm typecheck` passes

- [ ] **T13 — Verification**
  - `pnpm typecheck` → clean
  - `cargo check` → clean
  - `pnpm vitest run` → 11/11 unit tests pass + new Rust tests pass
  - Manual: export a 4-frame 32×32 project at 2× → verify PNG dimensions (64×64 each), open in browser
  - Manual: export spritesheet horizontal → verify layout, open sidecar JSON

## Dependencies

- T3 depends on T2 (needs DTOs)
- T4, T5 depend on T2
- T6 depends on T2, T3, T4, T5
- T7 depends on T6
- T10 depends on T8, T9
- T11 depends on T9, T10
- T12 depends on T11
- T13 is final — depends on all prior tasks
