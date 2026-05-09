use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanOffsetDto {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasConfigDto {
    pub width: u32,
    pub height: u32,
    pub color_mode: String,
    pub background_color: u32,
    pub dpi: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerDto {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f64,
    pub blend_mode: String,
}

/// Cell pixel data is `Vec<u8>` (raw RGBA bytes).
/// Transmitted as a JSON array of numbers over Tauri IPC.
/// Optimization path: switch to binary IPC in M13 for large canvases.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellDto {
    pub linked: bool,
    #[serde(default)]
    pub data: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameDto {
    pub id: String,
    pub duration: u32,
    pub cells: HashMap<String, CellDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwatchDto {
    pub color: u32,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteDto {
    pub id: String,
    pub name: String,
    pub swatches: Vec<SwatchDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagDto {
    pub id: String,
    pub name: String,
    pub from: u32,
    pub to: u32,
    pub loop_direction: String,
    pub color: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDto {
    pub schema_version: u32,
    pub project_id: String,
    pub name: String,
    pub author: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    pub application: String,
    pub canvas: CanvasConfigDto,
    pub layers: Vec<LayerDto>,
    pub frames: Vec<FrameDto>,
    pub palette: PaletteDto,
    pub tags: Vec<TagDto>,
    pub active_layer_id: Option<String>,
    pub active_frame_index: u32,
    pub zoom_level: f64,
    pub pan_offset: PanOffsetDto,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectPayload {
    pub project: ProjectDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub path: String,
    pub saved_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    pub project: ProjectDto,
    pub path: String,
    pub loaded_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFileEntry {
    pub path: String,
    pub name: String,
    pub missing: bool,
}
