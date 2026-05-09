# M9 — File I/O: Save / Open `.rabit` — Stage 2: Design

## Approach

All file I/O runs in Rust via Tauri IPC. TypeScript collects in-memory state, serializes it into a DTO, and hands it to Rust. Rust owns the disk: atomic write, checksum, path validation, compression, and deserialization all happen on the Rust side. The TypeScript side handles orchestration, store hydration, UI dialogs, and error display.

---

## Affected Components

### New Rust modules (`src-tauri/src/`)

| Module | Responsibility |
|---|---|
| `fs_sandbox.rs` | Path canonicalization and write-allowlist enforcement. Every I/O call passes through here first. |
| `project_io/dto.rs` | `ProjectDto`, `SaveProjectPayload`, `SaveResult`, `OpenResult` — Rust mirrors of TypeScript types |
| `project_io/limits.rs` | Hard limit constants and `check_limits()` enforcement before allocation |
| `project_io/error.rs` | `IoError` enum covering all failure modes |
| `project_io/format.rs` | 32-byte header read/write: magic `RBIT`, version u16, checksum u32 |
| `project_io/serialize.rs` | `atomic_write()`: Project → MessagePack → zstd → `.tmp` → verify → rename |
| `project_io/deserialize.rs` | Read → decompress → validate limits → `ProjectDto` |
| `project_io/migration.rs` | Migration pipeline stub (v1 has no migrations; chain for future v2+) |
| `project_io/commands.rs` | Six Tauri commands registered with `tauri::Builder` |
| `prefs.rs` | `preferences.toml` load/save; recent files list management |
| `file_watcher.rs` | `notify` v6 file watcher; emits `file:external_change` event to frontend |

**New Cargo.toml dependencies:**
```toml
rmp-serde = "1.3"
zstd = { version = "0.13", features = ["zstdmt"] }
notify = "6"
notify-debouncer-mini = "0.4"
rmpv = "1.0"
toml = "0.8"
```

### New TypeScript files (`src/`)

| File | Responsibility |
|---|---|
| `src/bridge/projectIpc.ts` | Typed `invoke()` wrappers for all six Rust commands + `listenExternalChange()` |
| `src/bridge/projectSerializer.ts` | `projectToDto()` and `dtoToProject()` — `Uint8ClampedArray` ↔ `number[]` conversion boundary |
| `src/bridge/fileWatchListener.ts` | Registers `file:external_change` Tauri event listener once on app mount |
| `src/state/action-composers/file-actions.ts` | All file orchestration: save, open, new, close-guard, dirty subscriptions, window title sync |
| `src/ui/primitives/Toast/` | Toast stack: error/info/warning toasts with auto-dismiss. Prerequisite for all error surfaces. |
| `src/ui/dialogs/UnsavedChangesDialog.tsx` | "Save / Discard / Cancel" modal |
| `src/ui/dialogs/ExternalChangeDialog.tsx` | "Reload / Keep" modal |
| `src/ui/dialogs/NewProjectDialog.tsx` | Canvas size + name form (32×32 default, 1–4096 bounded) |
| `src/ui/screens/WelcomeScreen.tsx` | Cold-launch overlay: new project + recent files + open file |
| `src/ui/menu/MenuBar.tsx` | Menu bar container (new layout row in App.tsx) |
| `src/ui/menu/FileMenu.tsx` | File dropdown: New, Open, Save, Save As, Recent Files submenu |
| `src/ui/menu/MenuItem.tsx` | Reusable `<button role="menuitem">` with label, shortcut hint, disabled, missing states |

### Modified TypeScript files

| File | Change |
|---|---|
| `src/state/useUIStore.ts` | Add: `unsavedChangesDialog`, `externalChangeDialog`, `welcomeScreen`, `recentFiles` state + actions |
| `src/state/useProjectStore.ts` | Verify `meta.dirty`, `meta.filePath`, `meta.name`, `meta.savedAt` exist; add `setDirty()` if missing |
| `src/App.tsx` | Add: menu bar row to CSS grid, keyboard shortcuts (Ctrl+N/O/S), `onCloseRequested` interception, dirty subscriptions, file watch listener, welcome screen conditional render |
| `src-tauri/src/lib.rs` | Register all six commands + manage `FileWatcher` and `Preferences` state |

---

## Data Model Changes

### Rust `ProjectDto` (`project_io/dto.rs`)
Mirrors the TypeScript `Project` type exactly. Cell pixel data as `Vec<u8>` (raw RGBA bytes — not JSON-encoded numbers, see IPC note below).

### `IoError` enum (`project_io/error.rs`)
```rust
pub enum IoError {
    CanvasTooLarge { width: u32, height: u32 },
    TooManyLayers(usize),
    TooManyFrames(usize),
    BadMagic,
    UnsupportedMajorVersion(u16),
    CorruptFile(String),
    ChecksumMismatch,
    MigrationFailed { from: u16, to: u16, reason: String },
    DiskFull,
    PermissionDenied(PathBuf),
    PathNotAllowed,
    Io(std::io::Error),
}
```

### `Preferences` struct (`prefs.rs`)
```rust
pub struct Preferences {
    pub schema_version: u32,
    pub recent: RecentPrefs,
}
pub struct RecentPrefs {
    pub files: Vec<String>,   // absolute paths, most-recent first
    pub max_entries: usize,   // default 10
}
```
Stored at `app.path().app_config_dir() / "preferences.toml"`. Loaded once at startup into `app.manage(Mutex<Preferences>)`.

### `useUIStore` additions
```typescript
unsavedChangesDialog: {
  open: boolean;
  intent: 'new' | 'open' | 'close' | null;
  pendingPath: string | null;
}
externalChangeDialog: { open: boolean; changedPath: string | null }
welcomeScreen: { visible: boolean }
recentFiles: RecentFileEntry[]
```

---

## Key Flows

### Save (Ctrl+S)
```
User presses Ctrl+S
→ file-actions.saveProject()
→ if no filePath → saveProjectAs() (dialog)
→ snapshotProject() assembles all stores into Project
→ projectToDto(project) → ProjectDto
→ ipcSaveProject(path, payload)  [Tauri IPC]
  → Rust: fs_sandbox.safe_write_path()
  → serialize → msgpack → zstd
  → write to .rabit.tmp
  → verify checksum
  → std::fs::rename(.tmp → .rabit)
  → push_recent_file + save prefs
  → return SaveResult { path, saved_at }
→ useProjectStore.setDirty(false), setFilePath(result.path), setSavedAt(result.saved_at)
→ syncWindowTitle()
→ ipcGetRecentFiles() → useUIStore.setRecentFiles()
```

### Open (Ctrl+O)
```
User presses Ctrl+O
→ file-actions.openProject()
→ confirmDiscardIfDirty()  [shows modal if dirty]
→ ipcOpenProject()  [Tauri IPC — opens native dialog]
  → Rust: native file picker → path selected
  → fs_sandbox.safe_read_path()
  → read + decompress + check_limits()
  → if older version → migration.migrate()
  → return OpenResult { project, path, loaded_at }
→ hydrateFromDto(result.project, result.path)
  → useProjectStore.reset(), useLayerStore.reset(), etc.
  → initFromDto(dto)
→ useProjectStore.setDirty(false), setFilePath(result.path)
→ syncWindowTitle()
→ fileWatcher.watch(result.path)  [Rust side via Tauri managed state]
→ ipcGetRecentFiles() → useUIStore.setRecentFiles()
```

### Close with unsaved changes
```
User clicks window X button
→ Tauri fires window:close-requested
→ App.tsx onCloseRequested handler: event.preventDefault()
→ confirmDiscardIfDirty()
  → if not dirty: win.destroy()
  → if dirty: show UnsavedChangesDialog (intent: 'close')
    Save → saveProject() → win.destroy()
    Discard → win.destroy()
    Cancel → no-op
```

### External file change
```
External process writes to the open .rabit file
→ notify (500ms debounce) fires
→ Rust emits file:external_change { path, changed_at }
→ fileWatchListener catches event
→ if |changed_at - savedAt| < 2000ms: suppress (it was our own save on Windows)
→ else: useUIStore.showExternalChangeDialog(path)
  Reload → fileActions.reloadFromDisk(path) → ipcOpenProjectAt(path) → hydrateFromDto()
  Keep → hideExternalChangeDialog(), setDirty(true)
```

### Cold launch (welcome screen)
```
App.tsx mounts
→ no CLI file arg, no autosave recovery (M10)
→ useUIStore.setWelcomeVisible(true)
→ ipcGetRecentFiles() → useUIStore.setRecentFiles()
→ WelcomeScreen renders (full-viewport overlay)
  "New Sprite" → NewProjectDialog → fileActions.newProject() → setWelcomeVisible(false)
  Recent file click → fileActions.openProjectAt() → setWelcomeVisible(false)
  "Open File…" → fileActions.openProject() → setWelcomeVisible(false)
  "Skip" → initNewProject('Untitled', 32, 32) → setWelcomeVisible(false)
```

---

## Trade-offs

### IPC binary data transfer
**Problem:** Pixel data as `number[]` in JSON over Tauri IPC is prohibitive for large canvases (a 4096×4096 single-layer project = 67 MB raw RGBA; JSON-encoded ~200 MB+).

**Decision:** Use Tauri 2's `Vec<u8>` direct binary handling. Tauri 2's `invoke` serializes `Vec<u8>` fields as binary (via `serde_bytes`) rather than JSON arrays when using the `tauri::ipc::InvokeBody` approach. Validate this behavior early in task 1 (a spike test). If Tauri 2 does not handle this transparently, use a two-call approach: first `save_project_metadata` (JSON, small), then a second Tauri resource/channel for raw pixel bytes.

### `notify` file watcher crate
**Decision:** `notify` v6 + `notify-debouncer-mini`. OS-native on all three platforms. Well-maintained. `tauri-plugin-fs-watch` exists but is a thin wrapper around the same crate with more Tauri coupling — using `notify` directly gives more control over debounce and filtering.

### Dialog state in `useUIStore` vs React local state
**Decision:** `useUIStore`. File-action composers need to trigger dialogs imperatively (from outside the React tree). Putting state in the store avoids prop drilling and is consistent with the existing pattern.

### `preferences.toml` vs `tauri-plugin-store`
**Decision:** Raw TOML per `docs/data-model.md §8`. Human-editable, no extra plugin dependency, matches the specified format exactly.

### Dirty tracking via Zustand `subscribe` (selector-based)
**Decision:** Subscribe to content fields only, not entire stores. Use Zustand's selector subscribe to avoid false-dirty from view state changes (cursor position, playback head, etc.):
```typescript
useLayerStore.subscribe(s => s.layers, () => useProjectStore.getState().setDirty(true));
useFrameStore.subscribe(s => s.frames, () => useProjectStore.getState().setDirty(true));
usePaletteStore.subscribe(s => s.palette, () => useProjectStore.getState().setDirty(true));
```

### MenuBar as a new App.tsx layout row
**Decision:** Add a new `auto` row to the CSS grid (currently `1fr 240px`, becomes `auto 1fr 240px`). The MenuBar occupies `grid-column: 1 / -1`. No sidebar or floating menu — consistent with Figma/Blender's menu bar layout.

---

## Risks

| Risk | Mitigation |
|---|---|
| Tauri 2 IPC binary transfer behavior is unclear | Spike test on Day 1 of implementation with a 4096×4096 dummy payload |
| `notify` on Windows fires for our own save (false external-change) | Suppress if `changedAt - savedAt < 2000ms` |
| Zustand selector subscribe fires on view-state changes | Subscribe only to content fields (layers, frames, palette), not entire store snapshots |
| Migration pipeline tested only as a stub | Document as known gap; first real migration will require revisiting `rmpv::Value` approach vs typed DTO conversion |
| `onCloseRequested` behavior differs on macOS (Cmd+Q vs red button) | Test both paths during Stage 4 on macOS |

---

## Source References
- `docs/data-model.md` §3 — `.rabit` binary format spec
- `docs/data-model.md` §7 — `preferences.toml` format
- `docs/data-model.md` §8 — migration strategy
- `docs/architecture.md` §tauri-ipc — IPC command contract
- `docs/architecture.md` §file-io — atomic write sequence, fs_sandbox rules
