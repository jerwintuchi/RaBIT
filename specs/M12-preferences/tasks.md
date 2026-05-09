# M12 — Preferences + Keybindings — Stage 3: Tasks

## Task List

- [ ] **T1 — Extend `prefs.rs` structs + commands**
  - File: `src-tauri/src/prefs.rs`
  - Add `UiPrefs`, `EditorPrefs`, `KeybindingPrefs` structs with `Default` impls
  - Extend `Preferences` with `ui`, `editor`, `keybindings` fields
  - Change `load_prefs` to return `(Preferences, bool)` — bool = was corrupt/missing
  - Add 3 Tauri commands: `prefs_load`, `prefs_save`, `prefs_reset`
  - Check: `cargo check` passes; unit tests for default values and TOML round-trip

- [ ] **T2 — Register new commands in `lib.rs`**
  - File: `src-tauri/src/lib.rs`
  - Update `load_prefs` call to handle new return type `(Preferences, bool)`
  - Add `prefs_load`, `prefs_save`, `prefs_reset` to `invoke_handler!`
  - Check: `cargo check` passes

- [ ] **T3 — `src/bridge/prefsIpc.ts`**
  - New file: TypeScript mirrors of `UiPrefs`, `EditorPrefs`, `KeybindingPrefs`, `Preferences`
  - Wrappers: `ipcPrefsLoad(): Promise<{ prefs: Preferences; wasCorrupt: boolean }>`, `ipcPrefsSave(prefs)`, `ipcPrefsReset(): Promise<Preferences>`
  - Check: `pnpm typecheck` passes

- [ ] **T4 — `src/state/usePrefsStore.ts`**
  - New Zustand store with:
    - `DEFAULT_KEYBINDINGS: Record<string, string>` constant (all 18 action IDs)
    - State: `uiScale`, `autosaveIntervalMinutes`, `maxUndoStack`, `defaultFrameDurationMs`, `keybindings` (merged defaults + overrides), `loaded: boolean`
    - Actions: `hydrate(prefs)`, `setUiScale()`, `setKeybinding(actionId, combo)`, `resetKeybinding(actionId)`, `resetAll()`
    - `hydrate` merges user overrides onto `DEFAULT_KEYBINDINGS`
    - `applyUiScale()` helper: sets `document.documentElement.style.zoom`
  - Export store + `DEFAULT_KEYBINDINGS` from `src/state/index.ts`
  - Check: `pnpm typecheck` passes; unit tests for merge logic and conflict detection helper

- [ ] **T5 — Wire App.tsx to usePrefsStore**
  - File: `src/App.tsx`
  - On mount: call `ipcPrefsLoad()`, hydrate store, apply UI scale; show toast if `wasCorrupt`
  - Replace hard-coded `TOOL_SHORTCUTS` constant with `usePrefsStore.getState().keybindings` lookup in the `onKeyDown` handler
  - Add Ctrl+, shortcut → `useUIStore.getState().showPrefsDialog()`
  - Dependencies: T3, T4
  - Check: `pnpm typecheck` passes

- [ ] **T6 — Add `prefsDialog` to `useUIStore`**
  - File: `src/state/useUIStore.ts`
  - Add `prefsDialog: { open: boolean }` state
  - Add `showPrefsDialog()` / `hidePrefsDialog()` actions
  - Check: `pnpm typecheck` passes

- [ ] **T7 — `PrefsDialog` component + CSS**
  - Files: `src/ui/dialogs/PrefsDialog.tsx`, `src/ui/dialogs/PrefsDialog.module.css`
  - Three tabs: General / Editor / Keybindings
  - **General tab:** UI scale radio buttons (0.9× / 1.0× / 1.25×)
  - **Editor tab:** autosave interval (number input, 1–60 min), max undo stack (number input, 100–5000), default frame duration (number input, 1–9999 ms)
  - **Keybindings tab:** table of all 18 actions — click row to capture next keydown; conflict chip shown inline if combo already taken; reset-to-default button per row
  - Local draft state (`useState`) — Cancel discards, Save commits to store + calls `ipcPrefsSave`
  - Reset to Defaults button in footer → calls `ipcPrefsReset`, hydrates store
  - Export from `src/ui/dialogs/index.ts`
  - Dependencies: T4, T6
  - Check: `pnpm typecheck` passes

- [ ] **T8 — EditMenu + MenuBar**
  - Files: `src/ui/menu/EditMenu.tsx`, `src/ui/menu/index.ts`, `src/ui/menu/MenuBar.tsx`
  - New `EditMenu` component following same pattern as `FileMenu`: trigger button + dropdown
  - Items: "Preferences…" (Ctrl+,) — calls `showPrefsDialog()`; "Undo" (Ctrl+Z); "Redo" (Ctrl+Y)
  - Mount `<EditMenu />` in `MenuBar` between File and any future menus
  - Dependencies: T6
  - Check: `pnpm typecheck` passes

- [ ] **T9 — Mount PrefsDialog in App.tsx**
  - File: `src/App.tsx`
  - Add `<PrefsDialog />` to the global overlays section
  - Dependencies: T7
  - Check: `pnpm typecheck` passes

- [ ] **T10 — Verification**
  - `pnpm typecheck` — zero errors
  - `cargo check` — zero errors
  - `pnpm test` — all unit tests pass (Rust TOML round-trip, TS keybinding merge logic)
  - Manual smoke test: change UI scale → takes effect immediately; remap a tool key → new key activates tool; restart app → settings restored; corrupt `preferences.toml` → toast shown, defaults used
  - Update `.rabit-memory/phase-tracker.md`

## Dependencies

```
T1 → T2
T1 → T3 → T4 → T5
T4 → T7
T6 → T7, T8
T7 → T9
T9 → T10
```
