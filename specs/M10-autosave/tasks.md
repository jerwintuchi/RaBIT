# M10 — Auto-save + Crash Recovery — Stage 3: Tasks

All tasks completed. Listed for reference.

## Tasks

- [x] **T1 — Write `src-tauri/src/auto_save.rs`**
  - Files: `src-tauri/src/auto_save.rs` (new)
  - Contents: `AutoSaveManifest`, `AutoSaveResult`, `RecoveryInfo` structs; path helpers (`autosave_dir`, `recovery_path`, `manifest_path`); manifest read/write helpers; `spawn_timer`; 5 Tauri commands (`auto_save_write`, `auto_save_check_recovery`, `auto_save_restore`, `auto_save_discard`, `auto_save_mark_clean`)
  - Check: `cargo check` passes

- [x] **T2 — Register `auto_save` in `lib.rs`**
  - Files: `src-tauri/src/lib.rs`
  - Changes: `mod auto_save;`, import 5 commands, call `auto_save::spawn_timer(app.handle().clone())` in `setup()`, add 5 commands to `invoke_handler!`
  - Check: `cargo check` passes

- [x] **T3 — Add `tokio "time"` feature to Cargo.toml**
  - Files: `src-tauri/Cargo.toml`
  - Changes: `tokio = { version = "1", features = ["sync", "time"] }`
  - Reason: `tokio::time::interval` requires the `time` feature flag; missing it causes a runtime panic
  - Check: `cargo check` passes

- [x] **T4 — Add auto-save IPC wrappers to `projectIpc.ts`**
  - Files: `src/bridge/projectIpc.ts`
  - Additions: `AutoSaveResult`, `RecoveryInfo` interfaces; `ipcAutoSaveWrite`, `ipcAutoSaveCheckRecovery`, `ipcAutoSaveRestore`, `ipcAutoSaveDiscard`, `ipcAutoSaveMarkClean` wrappers; `listenAutoSaveRequest` event listener
  - Check: `pnpm typecheck` passes

- [x] **T5 — Add `crashRecoveryDialog` to `useUIStore.ts`**
  - Files: `src/state/useUIStore.ts`
  - Additions: `crashRecoveryDialog: { open, savedAt, projectName }` state; `showCrashRecoveryDialog(savedAt, projectName)` and `hideCrashRecoveryDialog()` actions; initial state value
  - Check: `pnpm typecheck` passes

- [x] **T6 — Add auto-save actions to `file-actions.ts`**
  - Files: `src/state/action-composers/file-actions.ts`
  - Additions: import auto-save IPC functions; `writeAutoSave()`, `markAutoSaveClean()`, `restoreRecovery()`, `discardRecovery()`, `checkCrashRecovery()` functions
  - Changes: call `ipcAutoSaveMarkClean()` inside `saveProject()`, `saveProjectAs()`, and `handleCloseRequest()` after successful save/close
  - Check: `pnpm typecheck` passes

- [x] **T7 — Build `CrashRecoveryDialog` component**
  - Files: `src/ui/dialogs/CrashRecoveryDialog.tsx` (new), `src/ui/dialogs/CrashRecoveryDialog.module.css` (new), `src/ui/dialogs/index.ts`
  - UI: amber warning icon, project name + saved-at timestamp info card, description text, Discard + Restore buttons
  - Check: `pnpm typecheck` passes

- [x] **T8 — Wire `App.tsx`**
  - Files: `src/App.tsx`
  - Changes: import `listenAutoSaveRequest`, `CrashRecoveryDialog`; add `checkCrashRecovery` effect on mount; add `listenAutoSaveRequest` effect; mount `<CrashRecoveryDialog />` in both welcome and editor JSX branches
  - Check: `pnpm typecheck` passes

- [x] **T9 — Fix `SaveBadge` false-positive on project load**
  - Files: `src/ui/primitives/SaveBadge/SaveBadge.tsx`
  - Fix: initialize `prevSavedAt` ref to the current `savedAt` value (not `null`) so the badge does not fire when a project is loaded with a pre-existing `savedAt`
  - Check: `pnpm typecheck` passes

- [x] **T10 — Verification**
  - `pnpm typecheck` → clean
  - `cargo check` → clean (after adding tokio `time` feature)
  - `pnpm vitest run` → 11/11 unit tests pass
  - Manual: `npm run tauri dev` launches without panic

## Notes

- `tauri::async_runtime::spawn` must be used instead of `tokio::spawn` for the timer. Tauri's `setup()` closure runs before the Tokio runtime is active — `tokio::spawn` panics with "no reactor running".
- The `SaveBadge` false-positive was caused by `hydrateFromDto` calling `resetProject` with `savedAt: Date.now()`, which triggered the badge on every project load.
