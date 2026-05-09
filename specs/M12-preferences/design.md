# M12 — Preferences + Keybindings — Stage 2: Design

## Approach

Extend the existing `prefs.rs` (which already handles TOML read/write, atomic saves, and recent files) to cover UI scale, editor defaults, and keybindings. On the TypeScript side, introduce a `usePrefsStore` (Zustand) that is the single source of truth for runtime preferences. App.tsx reads keybindings from the store instead of the hard-coded `TOOL_SHORTCUTS` constant. A three-tab Preferences dialog (General / Editor / Keybindings) lets the user edit and persist settings.

## Affected Components

| File | Change |
|------|--------|
| `src-tauri/src/prefs.rs` | Extend `Preferences` struct with `[ui]`, `[editor]`, `[keybindings]` sections; add 3 new Tauri commands |
| `src-tauri/src/lib.rs` | Register 3 new commands in `invoke_handler!` |
| `src/bridge/prefsIpc.ts` | New — IPC wrappers for `prefs_load`, `prefs_save`, `prefs_reset` |
| `src/state/usePrefsStore.ts` | New — Zustand store; hydrates from Rust on startup; owns runtime keybindings |
| `src/App.tsx` | Replace hard-coded `TOOL_SHORTCUTS` with store-derived map; read keybindings dynamically |
| `src/state/useUIStore.ts` | Add `prefsDialog: { open: boolean }` + `showPrefsDialog` / `hidePrefsDialog` |
| `src/ui/dialogs/PrefsDialog.tsx` | New — three-tab dialog (General / Editor / Keybindings) |
| `src/ui/dialogs/PrefsDialog.module.css` | New — dialog styles |
| `src/ui/dialogs/index.ts` | Export `PrefsDialog` |
| `src/ui/menu/EditMenu.tsx` | New — "Edit" menu bar item with "Preferences…" (Ctrl+,) |
| `src/ui/menu/index.ts` | Export `EditMenu` |
| `src/ui/menu/MenuBar.tsx` | Mount `<EditMenu />` |

## Data Model Changes

### Rust — extended `Preferences` struct

```rust
pub struct UiPrefs {
    pub scale: f32,          // 0.9 | 1.0 | 1.25
}

pub struct EditorPrefs {
    pub autosave_interval_minutes: u32,   // default 5
    pub max_undo_stack: u32,              // default 1000
    pub default_frame_duration_ms: u32,  // default 100
}

pub struct KeybindingPrefs {
    // action_id → key combo string e.g. "Ctrl+S", "B"
    pub overrides: HashMap<String, String>,
}

pub struct Preferences {
    pub schema_version: u32,
    pub ui: UiPrefs,
    pub editor: EditorPrefs,
    pub keybindings: KeybindingPrefs,
    pub recent: RecentPrefs,  // already exists
}
```

### TypeScript — `usePrefsStore`

```ts
interface Keybindings {
  [actionId: string]: string;  // "tool.pencil" → "b"
}

interface PrefsState {
  uiScale: 0.9 | 1.0 | 1.25;
  autosaveIntervalMinutes: number;
  maxUndoStack: number;
  defaultFrameDurationMs: number;
  keybindings: Keybindings;   // merged: defaults + user overrides
  loaded: boolean;
}
```

### Default keybindings (action ID → key combo)

| Action ID | Default |
|-----------|---------|
| `tool.pencil` | `b` |
| `tool.eraser` | `e` |
| `tool.line` | `l` |
| `tool.eyedropper` | `i` |
| `tool.hand` | `h` |
| `tool.zoom` | `z` |
| `color.swap` | `x` |
| `color.reset` | `d` |
| `file.new` | `Ctrl+N` |
| `file.open` | `Ctrl+O` |
| `file.save` | `Ctrl+S` |
| `file.saveAs` | `Ctrl+Shift+S` |
| `file.export` | `Ctrl+E` |
| `edit.undo` | `Ctrl+Z` |
| `edit.redo` | `Ctrl+Y` |
| `frame.add` | `Ctrl+Alt+N` |
| `frame.duplicate` | `Ctrl+Alt+D` |
| `edit.preferences` | `Ctrl+,` |

## New Tauri Commands

```rust
#[tauri::command]
fn prefs_load(state: State<Mutex<Preferences>>) -> Preferences

#[tauri::command]
fn prefs_save(state: State<Mutex<Preferences>>, app: AppHandle, prefs: Preferences) -> Result<(), String>

#[tauri::command]
fn prefs_reset(state: State<Mutex<Preferences>>, app: AppHandle) -> Result<Preferences, String>
```

## Key Flows

### Startup hydration
1. `lib.rs` `setup()` already calls `prefs::load_prefs()` and stores in managed state.
2. App.tsx `useEffect` (mount) calls `ipcPrefsLoad()` → receives full prefs object.
3. `usePrefsStore.getState().hydrate(prefs)` merges overrides onto defaults, sets `loaded = true`.
4. `document.documentElement.style.zoom = String(uiScale)` applies scale before first render.

### Saving preferences
1. User edits in `PrefsDialog` → local draft state (not committed yet).
2. User clicks Save → `usePrefsStore.getState().apply(draft)` → `ipcPrefsSave(draft)` → Rust writes TOML atomically.
3. UI scale applied immediately to `<html>` zoom. Keybindings live-updated in store (App.tsx handler reads from store on every keydown).

### Keybinding capture
1. User clicks a keybinding row → row enters "listening" mode.
2. Next `keydown` event (excluding modifier-only) is captured as the new combo string.
3. Store checks all existing bindings for the same combo → shows inline conflict chip if found.
4. Save button disabled while any conflict exists.

### Corrupt / missing prefs
- Rust `load_prefs` already returns `Preferences::default()` on parse error.
- New: `load_prefs` returns a `(Preferences, bool)` — second value `true` if fallback was used.
- IPC returns `{ prefs, wasCorrupt: boolean }` — TypeScript shows a toast if `wasCorrupt`.

## Trade-offs

| Decision | Chosen | Rejected | Reason |
|----------|--------|----------|--------|
| Keybinding storage | Zustand (JS) owns runtime map; Rust only persists TOML | Rust owns and emits on every keydown | JS keyboard handler is in App.tsx — pulling from Rust on every keydown adds async overhead |
| UI scale mechanism | `document.documentElement.style.zoom` | CSS custom property + rem cascade | `zoom` is the simplest single-property that scales everything uniformly; rem cascade requires touching every component |
| Conflict detection | Client-side in PrefsStore | Server-side in Rust | Conflicts are pure data — no need for a round trip |
| Dialog draft state | Local `useState` in `PrefsDialog` | Edit in-place in store | Prevents half-saved state if user cancels |

## Risks

- `document.documentElement.style.zoom` is non-standard in some browsers but works correctly in WebView2 (Tauri on Windows) and WebKit (macOS). Safe for this target.
- Keybinding action IDs must stay stable — renaming an ID in code without a migration would silently lose user's saved binding. IDs are defined as constants in `usePrefsStore.ts`.
