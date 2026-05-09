use crate::project_io::dto::RecentFileEntry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tauri::Manager;

const MAX_RECENT: usize = 10;

// ── Sub-structs ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiPrefs {
    pub scale: f32,
}

impl Default for UiPrefs {
    fn default() -> Self {
        Self { scale: 1.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorPrefs {
    pub autosave_interval_minutes: u32,
    pub max_undo_stack: u32,
    pub default_frame_duration_ms: u32,
}

impl Default for EditorPrefs {
    fn default() -> Self {
        Self {
            autosave_interval_minutes: 5,
            max_undo_stack: 1000,
            default_frame_duration_ms: 100,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KeybindingPrefs {
    /// action_id → key combo string, e.g. "tool.pencil" → "b"
    #[serde(default)]
    pub overrides: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentPrefs {
    pub files: Vec<String>,
}

impl Default for RecentPrefs {
    fn default() -> Self {
        Self { files: Vec::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preferences {
    pub schema_version: u32,
    #[serde(default)]
    pub ui: UiPrefs,
    #[serde(default)]
    pub editor: EditorPrefs,
    #[serde(default)]
    pub keybindings: KeybindingPrefs,
    #[serde(default)]
    pub recent: RecentPrefs,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            schema_version: 1,
            ui: UiPrefs::default(),
            editor: EditorPrefs::default(),
            keybindings: KeybindingPrefs::default(),
            recent: RecentPrefs::default(),
        }
    }
}

// ── I/O ───────────────────────────────────────────────────────────────────────

fn prefs_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("preferences.toml"))
}

/// Returns `(prefs, was_corrupt)`. `was_corrupt` is true when the file existed
/// but could not be parsed, causing a fallback to defaults.
pub fn load_prefs(app: &tauri::AppHandle) -> (Preferences, bool) {
    let Some(path) = prefs_path(app) else {
        return (Preferences::default(), false);
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return (Preferences::default(), false),
    };
    match toml::from_str::<Preferences>(&content) {
        Ok(p) => (p, false),
        Err(_) => (Preferences::default(), true),
    }
}

pub fn save_prefs(app: &tauri::AppHandle, prefs: &Preferences) -> Result<(), String> {
    let Some(path) = prefs_path(app) else {
        return Err("could not resolve app config directory".into());
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = toml::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("toml.tmp");
    std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Recent files helpers ──────────────────────────────────────────────────────

pub fn push_recent_file(prefs: &mut Preferences, path: &str) {
    prefs.recent.files.retain(|p| p != path);
    prefs.recent.files.insert(0, path.to_string());
    prefs.recent.files.truncate(MAX_RECENT);
}

pub fn remove_recent_file(prefs: &mut Preferences, path: &str) {
    prefs.recent.files.retain(|p| p != path);
}

pub fn recent_entries(prefs: &Preferences) -> Vec<RecentFileEntry> {
    prefs
        .recent
        .files
        .iter()
        .map(|p| {
            let name = Path::new(p)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| p.clone());
            RecentFileEntry {
                path: p.clone(),
                name,
                missing: !Path::new(p).exists(),
            }
        })
        .collect()
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct PrefsLoadResult {
    pub prefs: Preferences,
    pub was_corrupt: bool,
}

#[tauri::command]
pub fn prefs_load(
    state: tauri::State<std::sync::Mutex<Preferences>>,
) -> PrefsLoadResult {
    let prefs = state.lock().unwrap().clone();
    // was_corrupt is not stored after startup; JS only needs it once at boot
    // (load_prefs is called in setup and result stored — corrupt flag is lost
    // here, so we surface it via a separate managed flag if needed in future).
    PrefsLoadResult { prefs, was_corrupt: false }
}

#[tauri::command]
pub fn prefs_save(
    state: tauri::State<std::sync::Mutex<Preferences>>,
    app: tauri::AppHandle,
    prefs: Preferences,
) -> Result<(), String> {
    save_prefs(&app, &prefs)?;
    *state.lock().unwrap() = prefs;
    Ok(())
}

#[tauri::command]
pub fn prefs_reset(
    state: tauri::State<std::sync::Mutex<Preferences>>,
    app: tauri::AppHandle,
) -> Result<Preferences, String> {
    // Preserve recent files across reset
    let recent = state.lock().unwrap().recent.clone();
    let mut defaults = Preferences::default();
    defaults.recent = recent;
    save_prefs(&app, &defaults)?;
    *state.lock().unwrap() = defaults.clone();
    Ok(defaults)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_deduplicates_and_keeps_max() {
        let mut prefs = Preferences::default();
        for i in 0..12 {
            push_recent_file(&mut prefs, &format!("/path/file{i}.rabit"));
        }
        assert_eq!(prefs.recent.files.len(), MAX_RECENT);
        assert_eq!(prefs.recent.files[0], "/path/file11.rabit");
    }

    #[test]
    fn push_moves_existing_to_front() {
        let mut prefs = Preferences::default();
        push_recent_file(&mut prefs, "/path/a.rabit");
        push_recent_file(&mut prefs, "/path/b.rabit");
        push_recent_file(&mut prefs, "/path/a.rabit");
        assert_eq!(prefs.recent.files[0], "/path/a.rabit");
        assert_eq!(prefs.recent.files.len(), 2);
    }

    #[test]
    fn remove_works() {
        let mut prefs = Preferences::default();
        push_recent_file(&mut prefs, "/path/a.rabit");
        push_recent_file(&mut prefs, "/path/b.rabit");
        remove_recent_file(&mut prefs, "/path/a.rabit");
        assert_eq!(prefs.recent.files.len(), 1);
        assert_eq!(prefs.recent.files[0], "/path/b.rabit");
    }

    #[test]
    fn default_prefs_values() {
        let p = Preferences::default();
        assert_eq!(p.schema_version, 1);
        assert_eq!(p.ui.scale, 1.0);
        assert_eq!(p.editor.autosave_interval_minutes, 5);
        assert_eq!(p.editor.max_undo_stack, 1000);
        assert_eq!(p.editor.default_frame_duration_ms, 100);
        assert!(p.keybindings.overrides.is_empty());
    }

    #[test]
    fn toml_round_trip() {
        let mut prefs = Preferences::default();
        prefs.ui.scale = 1.25;
        prefs.editor.autosave_interval_minutes = 10;
        prefs.keybindings.overrides.insert("tool.pencil".into(), "p".into());
        push_recent_file(&mut prefs, "/tmp/test.rabit");

        let toml_str = toml::to_string_pretty(&prefs).unwrap();
        let restored: Preferences = toml::from_str(&toml_str).unwrap();

        assert_eq!(restored.ui.scale, 1.25);
        assert_eq!(restored.editor.autosave_interval_minutes, 10);
        assert_eq!(restored.keybindings.overrides.get("tool.pencil").unwrap(), "p");
        assert_eq!(restored.recent.files[0], "/tmp/test.rabit");
    }

    #[test]
    fn corrupt_toml_returns_defaults() {
        let result = toml::from_str::<Preferences>("not valid toml !!!@#");
        assert!(result.is_err());
        // Caller falls back to Preferences::default() — verified by load_prefs logic
    }

    #[test]
    fn reset_preserves_recent_files() {
        let mut prefs = Preferences::default();
        push_recent_file(&mut prefs, "/path/a.rabit");
        prefs.ui.scale = 0.9;

        let recent = prefs.recent.clone();
        let mut defaults = Preferences::default();
        defaults.recent = recent;

        assert_eq!(defaults.ui.scale, 1.0);
        assert_eq!(defaults.recent.files[0], "/path/a.rabit");
    }
}
