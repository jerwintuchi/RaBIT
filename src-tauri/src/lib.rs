//! RaBIT Tauri backend.
//!
//! Module structure follows architecture.md §3. Each submodule is added in the
//! milestone that introduces it (see docs/milestones.md):
//!
//! - `fs_sandbox`       -> M9  (path canonicalization + allowlist)
//! - `project_io`       -> M9  (.rabit serialize/deserialize)
//! - `auto_save`        -> M10
//! - `crash_recovery`   -> M10
//! - `export`           -> M11 (PNG + spritesheet)
//! - `flood_fill`       -> M5  (scanline flood fill via rayon)

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(fmt::layer())
        .init();

    tracing::info!("RaBIT starting (v{})", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        .setup(|_app| {
            // Real setup (auto-save init, crash recovery scan) lands in M10.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
