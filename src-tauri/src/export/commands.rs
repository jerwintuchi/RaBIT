use super::{
    composite::{composite_frame, upscale},
    dto::{ExportProgress, ExportResult, FrameSelection, PngExportOptions, SpritesheetExportOptions},
    encode::{encode_png, write_png_file},
    spritesheet::{build_sheet, build_sidecar_json},
};
use crate::fs_sandbox::safe_write_path;
use std::path::Path;
use tauri::{AppHandle, Emitter};

// ── Filename helpers ──────────────────────────────────────────────────────────

/// Strip characters not safe for filenames on Windows/macOS/Linux.
fn sanitise(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect()
}

fn frame_filename(prefix: &str, frame_idx: usize) -> String {
    format!("{}_{:03}.png", sanitise(prefix), frame_idx + 1)
}

// ── PNG frames export ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_png(
    app: AppHandle,
    options: PngExportOptions,
) -> Result<ExportResult, String> {
    let scale = options.scale.clamp(1, 16);
    let project = options.project.clone();
    let out_dir = safe_write_path(Path::new(&options.output_dir))
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&out_dir).map_err(|e| format!("Cannot create output dir: {e}"))?;

    let frame_indices: Vec<usize> = match &options.frame_selection {
        FrameSelection::Current { index } => vec![*index as usize],
        FrameSelection::All => (0..project.frames.len()).collect(),
    };

    let total = frame_indices.len() as u32;
    let mut paths = Vec::new();

    for (done_idx, &frame_idx) in frame_indices.iter().enumerate() {
        let pixels = composite_frame(&project, frame_idx, options.include_background);
        let w = project.canvas.width;
        let h = project.canvas.height;
        let upscaled = upscale(&pixels, w, h, scale);
        let png_bytes = encode_png(&upscaled, w * scale, h * scale)?;

        let filename = frame_filename(&options.name_prefix, frame_idx);
        let out_path = out_dir.join(&filename);
        write_png_file(&out_path, &png_bytes)?;
        paths.push(out_path.to_string_lossy().into_owned());

        if let Err(e) = app.emit("export:progress", ExportProgress { done: done_idx as u32 + 1, total }) {
            tracing::warn!("export:progress emit failed: {e}");
        }
    }

    Ok(ExportResult { paths })
}

// ── Spritesheet export ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_spritesheet(
    app: AppHandle,
    options: SpritesheetExportOptions,
) -> Result<ExportResult, String> {
    let scale = options.scale.clamp(1, 16);
    let project = options.project.clone();
    let frame_count = project.frames.len();

    if frame_count == 0 {
        return Err("No frames to export".to_string());
    }

    let out_path = safe_write_path(Path::new(&options.output_path))
        .map_err(|e| e.to_string())?;
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Cannot create output dir: {e}"))?;
    }

    let src_w = project.canvas.width;
    let src_h = project.canvas.height;
    let frame_w = src_w * scale;
    let frame_h = src_h * scale;

    // Composite + upscale each frame, emitting progress
    let mut frame_buffers: Vec<Vec<u8>> = Vec::with_capacity(frame_count);
    for frame_idx in 0..frame_count {
        let pixels = composite_frame(&project, frame_idx, options.include_background);
        let upscaled = upscale(&pixels, src_w, src_h, scale);
        frame_buffers.push(upscaled);

        if let Err(e) = app.emit("export:progress", ExportProgress { done: frame_idx as u32 + 1, total: frame_count as u32 }) {
            tracing::warn!("export:progress emit failed: {e}");
        }
    }

    // Build sheet
    let (sheet, geo) = build_sheet(&frame_buffers, frame_w, frame_h, &options.layout, options.padding);
    let png_bytes = encode_png(&sheet, geo.sheet_w, geo.sheet_h)?;
    write_png_file(&out_path, &png_bytes)?;

    let mut result_paths = vec![out_path.to_string_lossy().into_owned()];

    // Optional sidecar JSON
    if options.sidecar_json {
        let image_filename = out_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "spritesheet.png".to_string());

        let json_val = build_sidecar_json(&image_filename, &geo, frame_w, frame_h, &project, scale);
        let json_path = out_path.with_extension("json");
        let json_str = serde_json::to_string_pretty(&json_val)
            .map_err(|e| format!("JSON serialize error: {e}"))?;
        std::fs::write(&json_path, json_str).map_err(|e| format!("JSON write error: {e}"))?;
        result_paths.push(json_path.to_string_lossy().into_owned());
    }

    if let Err(e) = app.emit("export:progress", ExportProgress { done: frame_count as u32, total: frame_count as u32 }) {
        tracing::warn!("export:progress emit failed: {e}");
    }

    Ok(ExportResult { paths: result_paths })
}
