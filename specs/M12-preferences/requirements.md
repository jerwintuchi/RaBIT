# M12 — Preferences + Keybindings — Stage 1: Requirements

## Problem Statement
All settings (keybindings, auto-save interval, UI preferences) are hardcoded. Users cannot customize the app to their workflow, and changes do not persist across restarts.

## User Stories
- As a pixel artist, I want to remap keyboard shortcuts to my preference so that I can match my existing muscle memory.
- As a pixel artist, I want my preferences to persist across app restarts so that I do not have to reconfigure on every launch.
- As a pixel artist, I want the app to gracefully handle a corrupt preferences file so that a bad config never prevents me from launching.

## Acceptance Criteria
- WHEN I remap a keybinding in the Preferences panel, THEN the new binding takes effect immediately without restarting.
- WHEN I restart the app, THEN all saved preferences (keybindings, auto-save interval, UI state) are restored.
- WHEN the preferences TOML file is corrupt or missing, THEN the app silently falls back to defaults and shows a non-blocking warning.
- WHEN a remapped keybinding conflicts with an existing one, THEN the conflict is shown to the user before saving.
- WHEN the recent files list contains a path that no longer exists, THEN it is shown as dimmed with a missing-file indicator and removed on click.

## Out of Scope
- Theme switching (single dark theme only in MVP)
- Plugin-defined preferences
- Cloud sync of preferences

## Open Questions
- None — `docs/data-model.md` §7 specifies the TOML preferences format and default values.

## Source References
- `docs/data-model.md` §7 — preferences storage format (TOML)
- `docs/design-system.md` §keyboard-shortcuts — keybinding panel visual spec
- `docs/PRD.md` §keyboard-shortcuts — P0 shortcut list
