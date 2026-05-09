# M10 — Auto-save + Crash Recovery — Stage 1: Requirements

## Problem Statement
If the app crashes or the user forgets to save, all unsaved work since the last manual save is lost. Auto-save writes a recovery file at a configurable interval so work can be recovered after an unexpected close.

## User Stories
- As a pixel artist, I want the app to automatically save a recovery copy at a regular interval so that a crash loses at most a few minutes of work.
- As a pixel artist, I want to be offered my last recovery file when I relaunch after a crash so that I can restore my session.
- As a pixel artist, I want to decline recovery and start fresh so that stale recovery files do not force unwanted restores.

## Acceptance Criteria
- WHEN the app has been open with unsaved changes for the configured interval (default: 5 minutes), THEN a recovery file is written to `{AppData}/rabit/autosave/recovery.rabit`.
- WHEN the app is force-killed mid-session, THEN the recovery file is present on disk.
- WHEN the app is relaunched after a crash, THEN a recovery dialog is shown offering to restore the last auto-save.
- WHEN the user accepts recovery, THEN the project opens as an untitled project with the recovered state.
- WHEN the user declines recovery, THEN the auto-save file is deleted.
- WHEN the user saves manually, THEN the auto-save file is deleted (no longer needed).

## Out of Scope
- Multiple recovery slots
- Recovery file browsing UI
- Configurable auto-save interval in this milestone (hardcoded default is acceptable; M12 adds preferences)

## Open Questions
- None — `docs/architecture.md` §auto-save defines the recovery file format and relaunch detection sequence.

## Source References
- `docs/architecture.md` §auto-save-crash-recovery — recovery file format, relaunch detection
- `docs/data-model.md` §4 — auto-save file format
