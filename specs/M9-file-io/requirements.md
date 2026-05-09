# M9 — File I/O: Save / Open `.rabit` — Stage 1: Requirements

## Problem Statement
Users cannot persist their work. There is no save, open, or new-project functionality. All project state is lost when the app closes. This is the highest-priority unimplemented P0 feature.

## User Stories
- As a pixel artist, I want to save my project to a `.rabit` file so that I can close the app and continue later.
- As a pixel artist, I want to open an existing `.rabit` file so that I can resume or share my work.
- As a pixel artist, I want the save operation to be safe so that a crash or power loss mid-save never corrupts my file.
- As a pixel artist, I want to start a new project without restarting the app so that I can quickly switch between projects.
- As a pixel artist, I want to be warned before unsaved changes are discarded so that I never accidentally lose work.
- As a pixel artist, I want a recent files list so that I can quickly reopen projects without navigating the file system.
- As a pixel artist, I want to be notified if a file I have open is modified externally so that I can decide whether to reload or keep my changes.
- As a pixel artist, I want clear error messages when a file cannot be opened so that I know what went wrong.

## Acceptance Criteria

### Save
- WHEN I choose File → Save on a new project, THEN I am prompted for a file path and the file is written as a valid `.rabit` binary.
- WHEN I choose File → Save on an existing project, THEN the file is overwritten atomically (write to `.rabit.tmp` → verify checksum → rename).
- WHEN I choose File → Save As, THEN I am prompted for a new path and the project is saved there; subsequent saves target the new path.
- WHEN I kill the app mid-save, THEN the original `.rabit` file is untouched.
- WHEN saving a 100-frame × 4-layer × 512×512 project, THEN the file is <10MB and save completes in <500ms.

### Open
- WHEN I choose File → Open and select a `.rabit` file, THEN the project loads pixel-identical to its saved state.
- WHEN I open a file that exceeds hard limits (>4096×4096, >256 layers, >10,000 frames), THEN the app rejects it with a user-friendly error message.
- WHEN I open a file from an older format version, THEN the migration pipeline runs and the project loads successfully.
- WHEN I open a corrupt or unreadable file, THEN the app shows a specific error and does not crash.

### New Project
- WHEN I choose File → New Project, THEN I am prompted with a new project dialog (canvas size, name).
- WHEN I choose File → New Project with unsaved changes, THEN I am asked to save or discard before the new project is created.

### Unsaved Changes
- WHEN the project has unsaved changes, THEN the window title shows an asterisk (e.g. `*My Project — RaBIT`).
- WHEN I attempt to close the app with unsaved changes, THEN a dialog asks to save, discard, or cancel.
- WHEN I attempt to open another file with unsaved changes, THEN a dialog asks to save or discard before proceeding.

### Recent Files
- WHEN I choose File → Recent Files, THEN a submenu lists the last 10 opened projects.
- WHEN I click a recent file that no longer exists on disk, THEN it is removed from the list and a brief error is shown.
- WHEN I save a new project, THEN it is added to the top of the recent files list.

### File Watching
- WHEN a `.rabit` file that is currently open is modified on disk by an external process, THEN the app shows a non-blocking notification offering to reload or keep the current version.
- WHEN the user chooses reload, THEN the project is reloaded from disk (unsaved changes are discarded after confirmation).
- WHEN the user dismisses the notification, THEN the file watcher is silenced for that session.

### Additional Quality-of-Life
- WHEN the app launches with no prior project, THEN a "Welcome / Recent Files" screen is shown rather than a blank canvas.
- WHEN a project is loaded, THEN the window title updates to show the project name and file path.
- WHEN the save operation fails (disk full, permissions error), THEN the error is surfaced clearly and the original file is guaranteed untouched.

## Out of Scope
- Auto-save and crash recovery (M10 — already specced)
- PNG / spritesheet export (M11 — already specced)
- Any format other than `.rabit`

## Source References
- `docs/data-model.md` §3 — `.rabit` binary format (header, MessagePack body, zstd compression, versioning, integrity)
- `docs/data-model.md` §8 — migration strategy
- `docs/architecture.md` §tauri-ipc — Tauri command contract
- `docs/architecture.md` §file-io — atomic write sequence, fs_sandbox
