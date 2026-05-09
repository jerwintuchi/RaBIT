use crate::project_io::dto::ProjectDto;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FrameSelection {
    Current { index: u32 },
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PngExportOptions {
    pub project: ProjectDto,
    pub frame_selection: FrameSelection,
    /// Integer upscale factor — 1 | 2 | 4 | 8 | 16.
    pub scale: u32,
    pub include_background: bool,
    /// Absolute path to output directory (validated by fs_sandbox).
    pub output_dir: String,
    /// Sanitised project name used as the filename prefix.
    pub name_prefix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SheetLayout {
    Horizontal,
    Vertical,
    Grid { columns: u32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpritesheetExportOptions {
    pub project: ProjectDto,
    pub layout: SheetLayout,
    /// Pixel gap between frames (0–16).
    pub padding: u32,
    pub scale: u32,
    pub include_background: bool,
    /// Absolute path including filename (e.g. /foo/bar/hero.png).
    pub output_path: String,
    pub sidecar_json: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// All file paths written (PNG + optional JSON).
    pub paths: Vec<String>,
}

/// Emitted as a Tauri event `export:progress` after each frame is processed.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub done: u32,
    pub total: u32,
}
