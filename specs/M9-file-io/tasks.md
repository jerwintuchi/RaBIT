# M9 — File I/O: Save / Open `.rabit` — Stage 3: Tasks

All tasks are ordered by dependency. Each is scoped to < 1 hour. Mark `[x]` as each completes.
Run `pnpm build` and `pnpm test` after every task. Report failures before moving to the next task.

---

## Rust Backend

### T1 — Cargo.toml: add M9 dependencies
- **Files:** `src-tauri/Cargo.toml`
- **What:** Add `rmp-serde = "1.3"`, `zstd = { version = "0.13", features = ["zstdmt"] }`, `notify = "6"`, `notify-debouncer-mini = "0.4"`, `rmpv = "1.0"`, `toml = "0.8"`, `serde_bytes = "0.11"`
- **Acceptance:** `cargo build --manifest-path src-tauri/Cargo.toml` succeeds with new deps resolved
- **Depends on:** nothing

### T2 — Spike: validate Tauri 2 IPC binary transfer for pixel data
- **Files:** `src-tauri/src/spike_ipc_binary.rs` (temporary, deleted after spike), `src/bridge/spikeIpc.ts` (temporary)
- **What:** Write a throwaway Tauri command that accepts a `Vec<u8>` payload of 67 MB (4096×4096×4 bytes of zeros) and returns it. Call it from TypeScript and measure round-trip time. Confirm no JSON encoding inflates the payload.
- **Acceptance:** Round-trip of 67 MB payload completes in < 2s; no "maximum string length exceeded" or out-of-memory errors; confirm via network tab / Tauri devtools that payload is not JSON-encoded. Delete spike files after confirming.
- **Depends on:** T1
- **Note:** If this fails, stop and report. The IPC binary strategy must be resolved before T6.

### T3 — `fs_sandbox.rs`: path canonicalization and allowlist
- **Files:** `src-tauri/src/fs_sandbox.rs`, `src-tauri/src/lib.rs` (add `mod fs_sandbox;`)
- **What:** Implement `safe_write_path(requested, allowed_roots) -> Result<PathBuf, SandboxError>` and `safe_read_path(requested) -> Result<PathBuf, SandboxError>`. `SandboxError` variants: `PathNotAllowed`, `PathTraversal`, `CanonicalizationFailed`, `NotAbsolute`. Write unit tests in the same file covering: valid path, traversal attempt (`../../etc/passwd`), relative path rejection.
- **Acceptance:** `cargo test` passes; traversal and relative paths are rejected
- **Depends on:** T1

### T4 — `project_io/error.rs`: IoError enum
- **Files:** `src-tauri/src/project_io/error.rs`, `src-tauri/src/project_io/mod.rs` (create with `pub mod error;`)
- **What:** Define `IoError` enum with all variants from the design doc. Implement `Display` and `From<std::io::Error>` (maps `ErrorKind::StorageFull` → `DiskFull`, `ErrorKind::PermissionDenied` → `PermissionDenied`, all others → `Io`). Implement `From<IoError> for String` (for Tauri command return types).
- **Acceptance:** `cargo build` succeeds; all variants are reachable (no dead_code warnings)
- **Depends on:** T1

### T5 — `project_io/limits.rs`: hard limit constants and enforcement
- **Files:** `src-tauri/src/project_io/limits.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod limits;`)
- **What:** Define constants: `MAX_CANVAS_DIM = 4096`, `MAX_LAYERS = 256`, `MAX_FRAMES = 10_000`, `MAX_CELLS = 1_000_000`, `MAX_PALETTE_SWATCHES = 65_535`, `MAX_COMPRESSED_BYTES`. Implement `check_limits(p: &ProjectDto) -> Result<(), IoError>`. Write unit tests: valid project passes, oversized canvas fails with `CanvasTooLarge`, etc.
- **Acceptance:** Unit tests pass for all limit variants
- **Depends on:** T4 (needs IoError)

### T6 — `project_io/dto.rs`: ProjectDto and command payloads
- **Files:** `src-tauri/src/project_io/dto.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod dto;`)
- **What:** Define `ProjectDto` mirroring the TypeScript `Project` type. Cell pixel data as `#[serde(with = "serde_bytes")] pub pixels: Vec<u8>`. Define `SaveProjectPayload`, `SaveResult`, `OpenResult`, `RecentFileEntry`. All structs derive `serde::Serialize, serde::Deserialize`.
- **Acceptance:** `cargo build` succeeds; roundtrip test: serialize `ProjectDto` to JSON and back with serde_json yields identical struct
- **Depends on:** T2 (binary IPC strategy confirmed), T4

### T7 — `project_io/format.rs`: `.rabit` header read/write
- **Files:** `src-tauri/src/project_io/format.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod format;`)
- **What:** Define `MAGIC = *b"RBIT"`, `FORMAT_MAJOR: u16 = 1`. Define `RabitHeader` struct (magic, major, minor, flags, uncompressed_size u64, compressed_size u64, reserved bytes to pad to 32 bytes). Implement `write_header(w, h)` and `read_header(r) -> Result<RabitHeader, IoError>` — validates magic bytes, returns `BadMagic` or `UnsupportedMajorVersion` on mismatch. Unit test: write then read yields identical header.
- **Acceptance:** Unit test passes; bad magic bytes return `BadMagic`
- **Depends on:** T4

### T8 — `project_io/migration.rs`: stub pipeline
- **Files:** `src-tauri/src/project_io/migration.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod migration;`)
- **What:** Implement `migrate(data: rmpv::Value, from_major: u16, to_major: u16) -> Result<rmpv::Value, IoError>`. If `from_major == to_major`, return `Ok(data)`. Otherwise return `MigrationFailed`. Unit test: same version returns Ok, different version returns Err.
- **Acceptance:** Unit tests pass
- **Depends on:** T4

### T9 — `project_io/serialize.rs`: atomic write
- **Files:** `src-tauri/src/project_io/serialize.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod serialize;`)
- **What:** Implement `atomic_write(path: &Path, project: &ProjectDto) -> Result<(), IoError>`:
  1. `rmp_serde::to_vec(project)` → msgpack bytes
  2. `zstd::encode_all(bytes, level=3)` → compressed bytes
  3. Write header + compressed body to `path.with_extension("rabit.tmp")`
  4. Verify: reopen `.tmp`, read header, decompress, check length matches `uncompressed_size`
  5. `std::fs::rename(.tmp, path)`
  Map all errors through `classify_io_error()`. Unit test: write a minimal ProjectDto, verify file exists and `.tmp` is gone after success.
- **Acceptance:** Unit test passes; `.tmp` file is never left on disk after success
- **Depends on:** T5, T6, T7

### T10 — `project_io/deserialize.rs`: read, decompress, validate
- **Files:** `src-tauri/src/project_io/deserialize.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod deserialize;`)
- **What:** Implement `read_project(path: &Path) -> Result<ProjectDto, IoError>`:
  1. Read and validate header (`read_header`)
  2. If `header.major != FORMAT_MAJOR` → run migration pipeline
  3. Read compressed body bytes
  4. `zstd::decode_all(body)` → msgpack bytes
  5. `rmp_serde::from_slice` → `ProjectDto`
  6. `check_limits(&dto)` before returning
  Wrap all errors appropriately (corrupt msgpack → `CorruptFile`). Unit test: roundtrip via `atomic_write` + `read_project` yields identical ProjectDto.
- **Acceptance:** Roundtrip unit test passes; corrupt file returns `CorruptFile`; oversized file returns appropriate limit error
- **Depends on:** T7, T8, T9

### T11 — `project_io/commands.rs`: six Tauri commands
- **Files:** `src-tauri/src/project_io/commands.rs`, `src-tauri/src/project_io/mod.rs` (add `pub mod commands;`)
- **What:** Implement all six commands:
  - `save_project(app, payload, path)` — `safe_write_path` + `atomic_write` + `push_recent_file` + return `SaveResult`
  - `save_project_as(app, payload)` — open native save dialog via `tauri_plugin_dialog`, then same as above
  - `open_project(app)` — native open dialog + `safe_read_path` + `read_project` + `push_recent_file` + return `OpenResult`
  - `open_project_at(app, path)` — same as open but skips dialog
  - `get_recent_files(app)` — read from managed `Preferences`, check each path for existence, return `Vec<RecentFileEntry>`
  - `remove_recent_file(app, path)` — remove from managed `Preferences`, flush prefs
  All commands return `Result<T, String>` (Tauri requirement). Errors are serialized via `IoError`'s `Display`.
- **Acceptance:** `cargo build` succeeds; `save_project` + `open_project_at` roundtrip integration test passes
- **Depends on:** T3, T6, T10, T12 (needs prefs for recent files)

### T12 — `prefs.rs`: TOML preferences + recent files
- **Files:** `src-tauri/src/prefs.rs`, `src-tauri/src/lib.rs` (add `mod prefs;`)
- **What:** Define `Preferences` and `RecentPrefs` structs. Implement:
  - `load_prefs(app) -> Preferences` — reads from `app_config_dir/preferences.toml`; on missing/corrupt file, returns `Preferences::default()` and logs a warning
  - `save_prefs(app, prefs) -> Result<(), IoError>` — writes TOML atomically
  - `push_recent_file(prefs, path)` — prepend, deduplicate, trim to `max_entries`
  - `remove_recent_file(prefs, path)` — remove by exact path match
  Unit test: push 12 files into a list with `max_entries=10`, verify length stays at 10 and most recent is first.
- **Acceptance:** Unit tests pass; corrupt prefs file returns default without panic
- **Depends on:** T4

### T13 — `file_watcher.rs`: notify file watcher
- **Files:** `src-tauri/src/file_watcher.rs`, `src-tauri/src/lib.rs` (add `mod file_watcher;`)
- **What:** Define `FileWatcher` struct holding `_watcher: Option<RecommendedWatcher>` and `watched_path: Option<PathBuf>`. Implement:
  - `new(app: AppHandle) -> Self`
  - `watch(&mut self, path: &Path) -> Result<(), notify::Error>` — creates debounced watcher (500ms), filters events to exact `watched_path`, emits `file:external_change` event via `app.emit()`
  - `unwatch(&mut self)` — drops `_watcher`, clears `watched_path`
  Store `FileWatcher` in Tauri managed state as `Mutex<FileWatcher>`.
- **Acceptance:** `cargo build` succeeds; manual test: open a file, edit it externally, confirm `file:external_change` event fires in frontend devtools within ~600ms
- **Depends on:** T1

### T14 — `lib.rs`: wire all Rust modules
- **Files:** `src-tauri/src/lib.rs`
- **What:** Add all module declarations (`mod fs_sandbox`, `mod project_io`, `mod prefs`, `mod file_watcher`). In `run()`: `.manage(Mutex::new(prefs::load_prefs_or_default(&app)))`, `.manage(Mutex::new(FileWatcher::new()))`, `.invoke_handler(tauri::generate_handler![...])` with all six commands. Wire `file_watcher` `AppHandle` injection in `.setup()`.
- **Acceptance:** `cargo build --manifest-path src-tauri/Cargo.toml` succeeds with no warnings; `pnpm tauri:dev` launches without panic
- **Depends on:** T11, T12, T13

---

## TypeScript Bridge

### T15 — `src/bridge/projectIpc.ts`: IPC wrappers
- **Files:** `src/bridge/projectIpc.ts`
- **What:** Export typed `invoke()` wrappers for all six Rust commands. Export types: `ProjectDto`, `SaveProjectPayload`, `SaveResult`, `OpenResult`, `RecentFileEntry`, `ExternalChangeEvent`. Export `listenExternalChange(handler) -> Promise<UnlistenFn>`. `ipcSaveProjectAs` and `ipcOpenProject` return `T | null` (null = user cancelled dialog).
- **Acceptance:** `pnpm typecheck` passes; no `any` types
- **Depends on:** T14

### T16 — `src/bridge/projectSerializer.ts`: DTO conversion
- **Files:** `src/bridge/projectSerializer.ts`
- **What:** Implement `projectToDto(project: Project): ProjectDto` — converts `Uint8ClampedArray` pixel data to `number[]` per cell. Implement `dtoToProject(dto: ProjectDto): Project` — converts `number[]` back to `Uint8ClampedArray`. This is the only file where this conversion happens. Write unit tests (Vitest): roundtrip a minimal project, verify pixel arrays are byte-identical.
- **Acceptance:** Unit tests pass; `pnpm typecheck` passes
- **Depends on:** T15

### T17 — `src/bridge/fileWatchListener.ts`: event listener setup
- **Files:** `src/bridge/fileWatchListener.ts`
- **What:** Export `startFileWatchListener(onExternalChange: (e: ExternalChangeEvent) => void): Promise<() => void>`. Internally calls `listenExternalChange` from `projectIpc.ts` and returns the unlisten function.
- **Acceptance:** `pnpm typecheck` passes
- **Depends on:** T15

---

## State Layer

### T18 — `useProjectStore`: verify and add missing file-state actions
- **Files:** `src/state/useProjectStore.ts`
- **What:** Read the current store. Verify `meta.dirty`, `meta.filePath`, `meta.name`, `meta.savedAt` exist with correct types. Add any missing fields and actions: `setDirty(dirty: boolean)`, `setFilePath(path: string | null)`, `setSavedAt(ts: number)`. Do not change existing fields or actions — additive only.
- **Acceptance:** `pnpm typecheck` passes; existing tests still pass
- **Depends on:** nothing (can run in parallel with T15–T17)

### T19 — `useUIStore`: add dialog, welcome screen, recent files state
- **Files:** `src/state/useUIStore.ts`
- **What:** Add to `UIState`:
  - `unsavedChangesDialog: { open: boolean; intent: 'new'|'open'|'close'|null; pendingPath: string|null }`
  - `externalChangeDialog: { open: boolean; changedPath: string|null }`
  - `welcomeScreen: { visible: boolean }`
  - `recentFiles: RecentFileEntry[]`
  Add actions: `showUnsavedChangesDialog`, `hideUnsavedChangesDialog`, `showExternalChangeDialog`, `hideExternalChangeDialog`, `setWelcomeVisible`, `setRecentFiles`. Initialize all new fields to safe defaults.
- **Acceptance:** `pnpm typecheck` passes; existing UI behavior unchanged
- **Depends on:** T15 (needs `RecentFileEntry` type)

### T20 — `file-actions.ts`: project snapshot and hydration utilities
- **Files:** `src/state/action-composers/file-actions.ts` (new file)
- **What:** Implement the two internal utilities used by all file operations:
  - `snapshotProject(): Project` — reads all stores (useProjectStore, useLayerStore, useFrameStore, usePaletteStore) and assembles a `Project` object
  - `hydrateFromDto(dto: ProjectDto, path: string): void` — resets all stores and populates them from the DTO (calls `initNewProject`-equivalent internally)
  Also implement `syncWindowTitle(): Promise<void>` — reads dirty + name + filePath from `useProjectStore`, calls `getCurrentWindow().setTitle(...)`.
- **Acceptance:** `pnpm typecheck` passes; snapshot + hydrate roundtrip unit test: snapshot a project, convert to DTO, hydrate from DTO, re-snapshot — layer count and frame count match
- **Depends on:** T16, T18, T19

### T21 — `file-actions.ts`: save operations
- **Files:** `src/state/action-composers/file-actions.ts`
- **What:** Implement:
  - `saveProject(): Promise<boolean>` — if no `filePath`, delegates to `saveProjectAs`; else calls `ipcSaveProject`, updates store, syncs title, refreshes recent files
  - `saveProjectAs(): Promise<boolean>` — calls `ipcSaveProjectAs`, handles null (cancelled), updates store, syncs title
  - Internal `refreshRecentFiles()` — calls `ipcGetRecentFiles()` + `useUIStore.setRecentFiles()`
- **Acceptance:** `pnpm typecheck` passes; manual test: save a project, verify `.rabit` file appears on disk, title loses asterisk, recent files list updates
- **Depends on:** T20

### T22 — `file-actions.ts`: open and reload operations
- **Files:** `src/state/action-composers/file-actions.ts`
- **What:** Implement:
  - `openProject(): Promise<boolean>` — calls `confirmDiscardIfDirty`, then `ipcOpenProject`, hydrates stores
  - `openProjectAt(path: string): Promise<boolean>` — calls `confirmDiscardIfDirty`, then `ipcOpenProjectAt`, hydrates stores; on failure removes from recent list + shows toast
  - `reloadFromDisk(path: string): Promise<void>` — calls `ipcOpenProjectAt`, clears undo history (`useHistoryStore.getState().clear()`), hydrates stores
  - `removeRecentFile(path: string): Promise<void>` — calls `ipcRemoveRecentFile`, refreshes recent files list
  - `clearRecentFiles(): Promise<void>` — calls `removeRecentFile` for each, refreshes list
- **Acceptance:** `pnpm typecheck` passes; manual test: open a saved project, verify stores hydrate and title updates
- **Depends on:** T21

### T23 — `file-actions.ts`: new project, close guard, dirty subscriptions
- **Files:** `src/state/action-composers/file-actions.ts`, `src/state/action-composers/index.ts`
- **What:** Implement:
  - `newProject(name: string, w: number, h: number): Promise<void>` — calls `confirmDiscardIfDirty`, then `initNewProject`, clears undo history, `setWelcomeVisible(false)`, unwatch file (emit `file:watch_clear` or call a Rust `clear_file_watch` command), syncs title
  - `newProjectWithDialog(): void` — shows `NewProjectDialog` via `useUIStore`
  - `confirmDiscardIfDirty(): Promise<boolean>` — checks `dirty`; if false returns `true`; if true, shows `UnsavedChangesDialog` and returns a Promise resolved by dialog buttons via a module-level deferred resolver
  - `resolvePendingDiscard(confirmed: boolean): void` — called by dialog buttons
  - `startDirtySubscriptions(): void` — sets up selector-based Zustand subscriptions for layer/frame/palette content changes → `setDirty(true)`
  Export all public functions from `index.ts`.
- **Acceptance:** `pnpm typecheck` passes; manual test: draw on canvas, observe asterisk in title bar; attempt to open file, confirm unsaved-changes dialog appears
- **Depends on:** T22

---

## UI Primitives

### T24 — `Toast` primitive
- **Files:** `src/ui/primitives/Toast/Toast.tsx`, `src/ui/primitives/Toast/Toast.module.css`, `src/ui/primitives/Toast/index.ts`
- **What:** A toast stack rendered in a fixed bottom-right container. `useUIStore` gets a `toasts: Toast[]` field and `addToast(message, variant: 'info'|'error'|'warning', duration?: number)` / `removeToast(id)` actions. Individual toasts auto-dismiss after `duration` ms (default 4000). Variants map to distinct border-left accent colors per design tokens. Export `<ToastContainer />` (renders all active toasts) and a `toast` helper that calls `useUIStore.getState().addToast`.
- **Acceptance:** `pnpm typecheck` passes; DevHarness manual test: trigger error/info/warning toasts, verify auto-dismiss and stacking
- **Depends on:** T19

### T25 — `UnsavedChangesDialog`
- **Files:** `src/ui/dialogs/UnsavedChangesDialog.tsx`, `src/ui/dialogs/UnsavedChangesDialog.module.css`, `src/ui/dialogs/index.ts`
- **What:** Modal using existing `ModalDialog` primitive. Three buttons: **Save** (calls `file-actions.saveProject()` then `resolvePendingDiscard(true)`), **Discard** (calls `resolvePendingDiscard(true)`), **Cancel** (calls `resolvePendingDiscard(false)`). `closeOnOverlayClick={false}`. Body text adapts to `intent`: "Opening a file", "Creating a new project", or "Closing". Reads open/intent from `useUIStore`.
- **Acceptance:** `pnpm typecheck` passes; clicking Save triggers save then resolves; clicking Cancel resolves false; clicking Discard resolves true without saving
- **Depends on:** T23, T24

### T26 — `ExternalChangeDialog` and `NewProjectDialog`
- **Files:** `src/ui/dialogs/ExternalChangeDialog.tsx`, `src/ui/dialogs/ExternalChangeDialog.module.css`, `src/ui/dialogs/NewProjectDialog.tsx`, `src/ui/dialogs/NewProjectDialog.module.css`
- **What:**
  - `ExternalChangeDialog`: Two buttons: **Reload** (calls `fileActions.reloadFromDisk(changedPath)`), **Keep** (hides dialog, marks dirty). Warning note: "Reloading will discard any unsaved changes." Reads state from `useUIStore.externalChangeDialog`.
  - `NewProjectDialog`: Form with name (text), width (number 1–4096, default 32), height (number 1–4096, default 32). On confirm: `fileActions.newProject(name, w, h)`. On cancel: closes dialog. Validates inputs before enabling confirm button.
- **Acceptance:** `pnpm typecheck` passes; width/height outside 1–4096 are rejected; confirm is disabled until inputs are valid
- **Depends on:** T23

---

## Screens and Menus

### T27 — `WelcomeScreen`
- **Files:** `src/ui/screens/WelcomeScreen.tsx`, `src/ui/screens/WelcomeScreen.module.css`, `src/ui/screens/index.ts`
- **What:** Full-viewport fixed overlay (z-index 100). Sections: logo area, "New Sprite" button (opens `NewProjectDialog`), recent files list (missing files grayed with remove button), "Open File…" button, "Skip — open blank canvas" footer link. Missing-file entries are non-clickable but show a remove icon. Load recent files from `useUIStore.recentFiles` (populated by App.tsx on mount).
- **Acceptance:** `pnpm typecheck` passes; missing recent files render grayed; "Skip" initializes a 32×32 blank project and hides the screen; "Open File…" triggers `fileActions.openProject()`
- **Depends on:** T22, T26

### T28 — `MenuItem`, `MenuBar`, `FileMenu`
- **Files:** `src/ui/menu/MenuItem.tsx`, `src/ui/menu/MenuBar.tsx`, `src/ui/menu/FileMenu.tsx`, `src/ui/menu/FileMenu.module.css`, `src/ui/menu/MenuBar.module.css`, `src/ui/menu/index.ts`
- **What:**
  - `MenuItem`: `<button role="menuitem">` with label, optional keyboard shortcut hint (right-aligned, muted), optional `disabled`, optional `missing` style (muted text). Closes parent menu on click.
  - `MenuBar`: horizontal bar, `grid-row: 1`, `grid-column: 1 / -1`, height matching design token for menu bars. Houses `<FileMenu />`.
  - `FileMenu`: dropdown trigger "File". Menu items: New (Ctrl+N), Open… (Ctrl+O), separator, Save (Ctrl+S, disabled when not dirty and filePath exists), Save As… (Ctrl+Shift+S), separator, Recent Files submenu (up to 10 entries + "Clear Recent Files"), separator, "No recent files" placeholder when list is empty. All actions delegate to `file-actions.ts`.
- **Acceptance:** `pnpm typecheck` passes; keyboard shortcuts shown in menu match the bindings wired in App.tsx; "Save" is disabled when project is clean; submenu renders missing files grayed
- **Depends on:** T23

---

## App Wiring

### T29 — `App.tsx`: full M9 wiring
- **Files:** `src/App.tsx`
- **What:** Wire everything together in a single task:
  1. **CSS grid:** add `auto` first row for `MenuBar` (`gridTemplateRows: 'auto 1fr 240px'`)
  2. **Render `<MenuBar />`** as first child
  3. **Render `<ToastContainer />`** (fixed, no grid row)
  4. **Render dialogs:** `<UnsavedChangesDialog />`, `<ExternalChangeDialog />`, `<NewProjectDialog />` (conditionally via `useUIStore`)
  5. **Welcome screen:** `if (welcomeVisible) return <WelcomeScreen />`
  6. **Keyboard shortcuts:** add Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S to the existing `onKeyDown` handler
  7. **Close interception:** `getCurrentWindow().onCloseRequested(...)` — `preventDefault`, call `confirmDiscardIfDirty`, then `win.destroy()` if confirmed
  8. **Dirty subscriptions:** call `fileActions.startDirtySubscriptions()` once in a `useEffect` on mount
  9. **File watch listener:** call `startFileWatchListener(...)` once in `useEffect` on mount, store unlisten fn for cleanup
  10. **Cold launch:** replace any existing `initNewProject('Untitled', ...)` cold-start call with `setWelcomeVisible(true)` + `ipcGetRecentFiles()` → `setRecentFiles()`
- **Acceptance:** `pnpm build` passes; `pnpm typecheck` passes; app launches showing WelcomeScreen; Ctrl+S triggers save flow; closing with unsaved changes shows dialog
- **Depends on:** T23, T24, T25, T26, T27, T28

---

## Verification

### T30 — Full M9 acceptance verification
- **Files:** none (verification only)
- **What:** Verify every acceptance criterion from `requirements.md` is met:
  - [ ] Save → `.rabit.tmp` → verify → rename (atomic write)
  - [ ] Kill app mid-save → original file untouched (manual test)
  - [ ] Open → pixel-identical reload (compare layer pixel arrays before/after)
  - [ ] Oversized file rejected with user-friendly error
  - [ ] Corrupt file rejected without crash
  - [ ] Older format version triggers migration stub (create a fake v0 header)
  - [ ] Window title shows asterisk when dirty
  - [ ] Prompt on close with unsaved changes
  - [ ] Prompt on open with unsaved changes
  - [ ] Prompt on new project with unsaved changes
  - [ ] Recent files list populates, persists across restart, handles missing files
  - [ ] External file change notification fires and offers Reload/Keep
  - [ ] Welcome screen shows on cold launch
  - [ ] New Project dialog validates canvas bounds (1–4096)
  - [ ] Save 100-frame × 4-layer × 512×512 → file < 10MB, time < 500ms
  - [ ] `pnpm build` passes (no type errors, no lint errors)
  - [ ] `pnpm test` passes (all unit tests)
- **Depends on:** T29
