//! RaBIT Tauri backend.
//!
//! Module structure follows architecture.md §3. Each submodule is added in the
//! milestone that introduces it (see docs/milestones.md):
//!
//! - `fs_sandbox`   -> M9  (path canonicalization + allowlist)
//! - `project_io`   -> M9  (.rabit serialize/deserialize)
//! - `prefs`        -> M9  (preferences.toml + recent files)
//! - `file_watcher` -> M9  (external file change detection)
//! - `auto_save`    -> M10
//! - `export`       -> M11 (PNG + spritesheet)
//! - `flood_fill`   -> M5  (scanline flood fill via rayon)

mod auto_save;
mod export;
mod file_watcher;
mod fs_sandbox;
mod prefs;
mod project_io;

use auto_save::{
    auto_save_check_recovery, auto_save_discard, auto_save_mark_clean, auto_save_restore,
    auto_save_write,
};
use export::commands::{export_png, export_spritesheet};
use file_watcher::FileWatcher;
use prefs::{prefs_load, prefs_reset, prefs_save};
use project_io::commands::{
    clear_file_watch, get_recent_files, open_project, open_project_at, remove_recent_file_cmd,
    save_project, save_project_as,
};
use std::sync::Mutex;
use tauri::Manager;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(fmt::layer())
        .init();

    tracing::info!("RaBIT starting (v{})", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Load preferences and expose to all commands via managed state
            let (prefs, _was_corrupt) = prefs::load_prefs(app.handle());
            app.manage(Mutex::new(prefs));

            // File watcher — AppHandle injected here so it can emit events
            let mut watcher = FileWatcher::new();
            watcher.set_handle(app.handle().clone());
            app.manage(Mutex::new(watcher));

            // Auto-save timer — fires autosave:request every 5 minutes
            auto_save::spawn_timer(app.handle().clone());

            tracing::info!("RaBIT setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_project,
            save_project_as,
            open_project,
            open_project_at,
            get_recent_files,
            remove_recent_file_cmd,
            clear_file_watch,
            auto_save_write,
            auto_save_check_recovery,
            auto_save_restore,
            auto_save_discard,
            auto_save_mark_clean,
            export_png,
            export_spritesheet,
            prefs_load,
            prefs_save,
            prefs_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
