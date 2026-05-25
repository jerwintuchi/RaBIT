use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceImageResult {
    pub pixels: Vec<u8>, // raw RGBA bytes
    pub width: u32,
    pub height: u32,
}

/// Load and decode a reference image file (PNG, JPEG, or WebP) to raw RGBA bytes.
#[tauri::command]
pub fn load_reference_image(path: String) -> Result<ReferenceImageResult, String> {
    use crate::fs_sandbox::safe_read_path;
    use std::path::Path;

    let safe = safe_read_path(Path::new(&path)).map_err(|e| e.to_string())?;

    let img = image::open(&safe)
        .map_err(|e| format!("Failed to open reference image: {e}"))?
        .into_rgba8();

    let width = img.width();
    let height = img.height();
    let pixels = img.into_raw();

    Ok(ReferenceImageResult { pixels, width, height })
}
