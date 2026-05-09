# M10 — Auto-save + Crash Recovery — Stage 2: Design

## Approach

Project state lives entirely in TypeScript (React/Zustand). Rust cannot serialize it independently. The auto-save flow is a two-leg round trip:

1. Rust timer fires every 5 minutes → emits `autosave:request` event to frontend
2. Frontend serializes the current project → calls `invoke('auto_save_write', { payload })`
3. Rust writes `recovery.rabit` atomically, updates `manifest.json`, emits `autosave:complete`

Crash detection is manifest-based: the manifest carries a `clean_exit: bool` flag. On startup, Rust reads the manifest — if `clean_exit: false` and `recovery.rabit` exists, there is a stale session to recover.

---

## Affected Components

| File | Change |
|---|---|
| `src-tauri/src/auto_save.rs` | **New** — timer spawn, 5 IPC commands, manifest read/write, path helpers |
| `src-tauri/src/lib.rs` | Register `auto_save` mod + 5 new commands; spawn timer in `setup()` |
| `src-tauri/Cargo.toml` | Add `time` feature to tokio dependency |
| `src/bridge/projectIpc.ts` | 5 new IPC wrappers + `listenAutoSaveRequest` event listener |
| `src/state/useUIStore.ts` | Add `crashRecoveryDialog` state + `showCrashRecoveryDialog` / `hideCrashRecoveryDialog` |
| `src/state/action-composers/file-actions.ts` | Add `writeAutoSave`, `markAutoSaveClean`, `restoreRecovery`, `discardRecovery`, `checkCrashRecovery`; call `ipcAutoSaveMarkClean` inside `saveProject`, `saveProjectAs`, `handleCloseRequest` |
| `src/ui/dialogs/CrashRecoveryDialog.tsx` + `.module.css` | **New** — recovery dialog (Restore / Discard) |
| `src/ui/dialogs/index.ts` | Export `CrashRecoveryDialog` |
| `src/ui/primitives/SaveBadge/SaveBadge.tsx` | Initialize `prevSavedAt` ref to current value to suppress false badge on project load |
| `src/App.tsx` | Check recovery on mount; listen `autosave:request`; mount `CrashRecoveryDialog` in both welcome + editor branches |

---

## Data Model

**`{AppData}/rabit/autosave/manifest.json`** (serde_json):
```json
{
  "recovery_path": "/abs/path/recovery.rabit",
  "saved_at": 1234567890,
  "project_name": "MySprite",
  "clean_exit": false
}
```

**`{AppData}/rabit/autosave/recovery.rabit`** — identical binary format to a normal `.rabit` file. Reuses `project_io::serialize::atomic_write` and `project_io::deserialize::read_project` with no changes.

Only one recovery slot — new auto-save overwrites the previous.

---

## New Rust Commands

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `auto_save_write` | `payload: SaveProjectPayload` | `AutoSaveResult { saved_at }` | Write recovery file + manifest (`clean_exit: false`) |
| `auto_save_check_recovery` | — | `Option<RecoveryInfo>` | Read manifest; return info if `clean_exit == false` and file exists |
| `auto_save_restore` | — | `OpenResult` | Read recovery.rabit → return ProjectDto |
| `auto_save_discard` | — | `()` | Delete recovery.rabit + manifest |
| `auto_save_mark_clean` | — | `()` | Set `clean_exit: true` in manifest |

---

## Key Flows

**Auto-save tick (every 5 min):**
```
[Rust tokio task] → emit autosave:request
  → App.tsx listener fires
  → checks hasProject (skips if no project open)
  → fileActions.writeAutoSave()
  → snapshotProject() → invoke('auto_save_write', payload)
  → Rust: atomic_write(recovery.rabit) → write manifest (clean_exit: false)
```

**Manual save (Ctrl+S):**
```
saveProject() → ipcSaveProject() → success
  → window.__rabitSavedAt = Date.now()
  → markSaved() → setFilePath() → setName()
  → ipcAutoSaveMarkClean()   ← manifest.clean_exit = true
  → syncWindowTitle() → refreshRecentFiles()
```

**Clean exit:**
```
handleCloseRequest() → confirmDiscardIfDirty → confirmed
  → ipcAutoSaveMarkClean()   ← manifest.clean_exit = true
  → getCurrentWindow().destroy()
```

**App launch after crash:**
```
App.tsx useEffect (mount) → fileActions.checkCrashRecovery()
  → ipcAutoSaveCheckRecovery()
  → Rust: manifest exists + clean_exit: false + recovery.rabit exists
  → returns RecoveryInfo { saved_at, project_name }
  → useUIStore.showCrashRecoveryDialog(saved_at, project_name)
  → CrashRecoveryDialog renders over welcome screen

  "Restore" → fileActions.restoreRecovery()
    → ipcAutoSaveRestore() → hydrateFromDto as untitled (filePath: null, dirty: true)
    → ipcAutoSaveDiscard() → hideCrashRecoveryDialog()

  "Discard" → fileActions.discardRecovery()
    → ipcAutoSaveDiscard() → hideCrashRecoveryDialog()
```

---

## Trade-offs

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Timer location | Rust (`tauri::async_runtime::spawn`) | JS `setInterval` | Rust timer fires reliably regardless of JS event loop load; JS can be starved mid-draw |
| Timer spawn API | `tauri::async_runtime::spawn` | `tokio::spawn` | Tauri's `setup()` closure runs before the Tokio runtime is active; `tokio::spawn` panics |
| Recovery format | Same `.rabit` binary format | Separate JSON snapshot | Reuses all existing serialize/deserialize code with zero duplication |
| Recovery slots | Single slot | Multiple slots | Simpler manifest; no slot-picker UI needed |
| Clean exit signal | `clean_exit` flag in manifest | Delete manifest on exit | Flag survives if the OS kills the process during shutdown before a delete completes |

---

## Risks

- **Auto-save during large canvas**: Snapshotting a 640×640 × many layers blocks the JS thread briefly. Acceptable at M10 canvas limit; revisit in M13 perf audit.
- **`tokio::time` feature not enabled**: Requires adding `"time"` to tokio features in Cargo.toml — easy to miss, causes a runtime panic (encountered and fixed during implementation).
