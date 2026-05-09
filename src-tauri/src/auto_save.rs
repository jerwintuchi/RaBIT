//! M10 — Auto-save + crash recovery.
//!
//! # Flow
//!
//! 1. `spawn_timer` starts a background tokio task that emits `autosave:request`
//!    every AUTO_SAVE_INTERVAL_SECS seconds.
//! 2. The frontend serializes the current project and calls `auto_save_write`.
//! 3. `auto_save_write` writes `recovery.rabit` (same format as a normal .rabit)
//!    atomically, then updates `manifest.json` with `clean_exit: false`.
//! 4. On startup the frontend calls `auto_save_check_recovery`. If the manifest
//!    exists with `clean_exit: false`, recovery info is returned and the UI shows
//!    a recovery dialog.
//! 5. `auto_save_restore` re-reads recovery.rabit and returns the ProjectDto.
//! 6. `auto_save_discard` deletes both files.
//! 7. `auto_save_mark_clean` sets `clean_exit: true` — called after every manual
//!    save and on clean app exit. This prevents a false recovery prompt next launch.

use crate::project_io::{
    deserialize::read_project,
    dto::{OpenResult, SaveProjectPayload},
    serialize::{atomic_write, unix_ms_now},
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

const AUTO_SAVE_INTERVAL_SECS: u64 = 300; // 5 minutes
const RECOVERY_FILENAME: &str = "recovery.rabit";
const MANIFEST_FILENAME: &str = "manifest.json";
const AUTOSAVE_DIR: &str = "autosave";

// ── Manifest ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct AutoSaveManifest {
    recovery_path: String,
    saved_at: i64,
    project_name: String,
    clean_exit: bool,
}

// ── DTOs (mirrored in projectIpc.ts) ─────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct AutoSaveResult {
    pub saved_at: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct RecoveryInfo {
    pub saved_at: i64,
    pub project_name: String,
}

// ── Path helpers ──────────────────────────────────────────────────────────────

fn autosave_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    let dir = data_dir.join(AUTOSAVE_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create autosave dir: {e}"))?;
    Ok(dir)
}

fn recovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(autosave_dir(app)?.join(RECOVERY_FILENAME))
}

fn manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(autosave_dir(app)?.join(MANIFEST_FILENAME))
}

// ── Manifest helpers ──────────────────────────────────────────────────────────

fn read_manifest(path: &PathBuf) -> Option<AutoSaveManifest> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn write_manifest(path: &PathBuf, manifest: &AutoSaveManifest) -> Result<(), String> {
    let json =
        serde_json::to_vec_pretty(manifest).map_err(|e| format!("manifest serialize: {e}"))?;
    // Atomic write for the manifest too: write to .tmp, rename
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, &json).map_err(|e| format!("manifest write: {e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("manifest rename: {e}"))?;
    Ok(())
}

// ── Background timer ──────────────────────────────────────────────────────────

/// Spawns a background tokio task that emits `autosave:request` on each tick.
/// Call once from `tauri::Builder::setup`.
pub fn spawn_timer(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval =
            tokio::time::interval(std::time::Duration::from_secs(AUTO_SAVE_INTERVAL_SECS));
        interval.tick().await; // skip the immediate first tick
        loop {
            interval.tick().await;
            if let Err(e) = app.emit("autosave:request", ()) {
                tracing::warn!("autosave:request emit failed: {e}");
            }
        }
    });
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Write the recovery file + manifest. Called by the frontend after `autosave:request`.
#[tauri::command]
pub async fn auto_save_write(
    app: AppHandle,
    payload: SaveProjectPayload,
) -> Result<AutoSaveResult, String> {
    let rec_path = recovery_path(&app)?;
    let mfst_path = manifest_path(&app)?;

    atomic_write(&rec_path, &payload.project).map_err(|e| e.to_string())?;

    let saved_at = unix_ms_now();
    let manifest = AutoSaveManifest {
        recovery_path: rec_path.to_string_lossy().into_owned(),
        saved_at,
        project_name: payload.project.name.clone(),
        clean_exit: false,
    };
    write_manifest(&mfst_path, &manifest)?;

    tracing::debug!("auto-save written at {saved_at}");
    Ok(AutoSaveResult { saved_at })
}

/// Check on startup whether a crash recovery is available.
/// Returns `None` if there is no stale session.
#[tauri::command]
pub async fn auto_save_check_recovery(app: AppHandle) -> Result<Option<RecoveryInfo>, String> {
    let mfst_path = manifest_path(&app)?;
    let Some(manifest) = read_manifest(&mfst_path) else {
        return Ok(None);
    };
    if manifest.clean_exit {
        return Ok(None);
    }
    // Verify the recovery file actually exists before promising it
    let rec = recovery_path(&app)?;
    if !rec.exists() {
        return Ok(None);
    }
    Ok(Some(RecoveryInfo {
        saved_at: manifest.saved_at,
        project_name: manifest.project_name,
    }))
}

/// Read recovery.rabit and return it as an OpenResult (same shape as open_project_at).
#[tauri::command]
pub async fn auto_save_restore(app: AppHandle) -> Result<OpenResult, String> {
    let rec_path = recovery_path(&app)?;
    let project = read_project(&rec_path).map_err(|e| e.to_string())?;
    let loaded_at = unix_ms_now();
    Ok(OpenResult {
        project,
        path: rec_path.to_string_lossy().into_owned(),
        loaded_at,
    })
}

/// Delete recovery.rabit + manifest. Called after restore or user declines.
#[tauri::command]
pub async fn auto_save_discard(app: AppHandle) -> Result<(), String> {
    let rec_path = recovery_path(&app)?;
    let mfst_path = manifest_path(&app)?;
    let _ = std::fs::remove_file(&rec_path);
    let _ = std::fs::remove_file(&mfst_path);
    tracing::debug!("auto-save recovery discarded");
    Ok(())
}

/// Mark the manifest as clean_exit: true. Called after every successful manual save
/// and on clean app shutdown. Prevents a false recovery prompt on next launch.
#[tauri::command]
pub async fn auto_save_mark_clean(app: AppHandle) -> Result<(), String> {
    let mfst_path = manifest_path(&app)?;
    let Some(mut manifest) = read_manifest(&mfst_path) else {
        return Ok(()); // no manifest — nothing to mark
    };
    manifest.clean_exit = true;
    write_manifest(&mfst_path, &manifest)?;
    tracing::debug!("auto-save marked clean");
    Ok(())
}
