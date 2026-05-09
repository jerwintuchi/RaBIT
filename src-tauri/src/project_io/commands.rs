use super::{
    deserialize::read_project,
    dto::{OpenResult, RecentFileEntry, SaveProjectPayload, SaveResult},
    serialize::{atomic_write, unix_ms_now},
};
use crate::{
    file_watcher::FileWatcher,
    fs_sandbox::{safe_read_path, safe_write_path},
    prefs::{push_recent_file, recent_entries, remove_recent_file, save_prefs, Preferences},
};
use std::sync::Mutex;
use tauri::Manager;

// ── Save ────────────────────────────────────────────────────────────────────

/// Save to an already-known path (no dialog).
#[tauri::command]
pub async fn save_project(
    app: tauri::AppHandle,
    payload: SaveProjectPayload,
    path: String,
) -> Result<SaveResult, String> {
    let save_path = safe_write_path(std::path::Path::new(&path)).map_err(|e| e.to_string())?;

    atomic_write(&save_path, &payload.project).map_err(|e| e.to_string())?;

    let saved_at = unix_ms_now();

    // Update recent files
    {
        let state = app.state::<Mutex<Preferences>>();
        let mut prefs = state.lock().unwrap();
        push_recent_file(&mut prefs, &path);
        if let Err(e) = save_prefs(&app, &prefs) {
            tracing::warn!("save_prefs failed: {e}");
        }
    }

    Ok(SaveResult { path, saved_at })
}

/// Open a native Save dialog, then write atomically.
/// Returns `None` if the user cancelled.
#[tauri::command]
pub async fn save_project_as(
    app: tauri::AppHandle,
    payload: SaveProjectPayload,
) -> Result<Option<SaveResult>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();
    app.dialog()
        .file()
        .add_filter("RaBIT Project", &["rabit"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let maybe_path = rx.await.map_err(|_| "dialog channel closed".to_string())?;
    let Some(file_path) = maybe_path else {
        return Ok(None); // user cancelled
    };

    let path_str = file_path.to_string();
    let save_path = safe_write_path(std::path::Path::new(&path_str)).map_err(|e| e.to_string())?;

    atomic_write(&save_path, &payload.project).map_err(|e| e.to_string())?;

    let saved_at = unix_ms_now();

    {
        let state = app.state::<Mutex<Preferences>>();
        let mut prefs = state.lock().unwrap();
        push_recent_file(&mut prefs, &path_str);
        if let Err(e) = save_prefs(&app, &prefs) {
            tracing::warn!("save_prefs failed: {e}");
        }
    }

    // Switch file watcher to new path
    {
        let watcher_state = app.state::<Mutex<FileWatcher>>();
        let mut watcher = watcher_state.lock().unwrap();
        watcher.watch(&save_path).ok();
    }

    Ok(Some(SaveResult {
        path: path_str,
        saved_at,
    }))
}

// ── Open ────────────────────────────────────────────────────────────────────

/// Open a native Open dialog, then load the selected file.
/// Returns `None` if the user cancelled.
#[tauri::command]
pub async fn open_project(app: tauri::AppHandle) -> Result<Option<OpenResult>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();
    app.dialog()
        .file()
        .add_filter("RaBIT Project", &["rabit"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let maybe_path = rx.await.map_err(|_| "dialog channel closed".to_string())?;
    let Some(file_path) = maybe_path else {
        return Ok(None);
    };

    let path_str = file_path.to_string();
    open_at_path(&app, path_str).await.map(Some)
}

/// Open a specific path (e.g. from the recent files list — no dialog).
#[tauri::command]
pub async fn open_project_at(app: tauri::AppHandle, path: String) -> Result<OpenResult, String> {
    open_at_path(&app, path).await
}

async fn open_at_path(app: &tauri::AppHandle, path: String) -> Result<OpenResult, String> {
    let read_path = safe_read_path(std::path::Path::new(&path)).map_err(|e| e.to_string())?;

    let project = read_project(&read_path).map_err(|e| e.to_string())?;
    let loaded_at = unix_ms_now();

    {
        let state = app.state::<Mutex<Preferences>>();
        let mut prefs = state.lock().unwrap();
        push_recent_file(&mut prefs, &path);
        save_prefs(app, &prefs).ok();
    }

    {
        let watcher_state = app.state::<Mutex<FileWatcher>>();
        let mut watcher = watcher_state.lock().unwrap();
        watcher.watch(&read_path).ok();
    }

    Ok(OpenResult {
        project,
        path,
        loaded_at,
    })
}

// ── Recent Files ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<RecentFileEntry>, String> {
    let state = app.state::<Mutex<Preferences>>();
    let prefs = state.lock().unwrap();
    Ok(recent_entries(&prefs))
}

#[tauri::command]
pub async fn remove_recent_file_cmd(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<Mutex<Preferences>>();
    let mut prefs = state.lock().unwrap();
    remove_recent_file(&mut prefs, &path);
    save_prefs(&app, &prefs)
}

// ── File Watch ───────────────────────────────────────────────────────────────

/// Stop watching the current file (called on New Project).
#[tauri::command]
pub async fn clear_file_watch(app: tauri::AppHandle) -> Result<(), String> {
    let watcher_state = app.state::<Mutex<FileWatcher>>();
    let mut watcher = watcher_state.lock().unwrap();
    watcher.unwatch();
    Ok(())
}
