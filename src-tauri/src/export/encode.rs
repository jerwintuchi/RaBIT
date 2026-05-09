use std::io::Cursor;

/// Encode raw RGBA pixels into a PNG byte buffer.
/// Writes a `tEXt` chunk with `Software = "RaBIT 0.1.0"` per data-model §5.3.
pub fn encode_png(pixels: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut encoder = png::Encoder::new(cursor, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        // tEXt metadata chunk
        encoder
            .add_text_chunk("Software".to_string(), "RaBIT 0.1.0".to_string())
            .map_err(|e| format!("PNG metadata error: {e}"))?;

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header error: {e}"))?;

        writer
            .write_image_data(pixels)
            .map_err(|e| format!("PNG data error: {e}"))?;
    }
    Ok(buf)
}

/// Write a PNG buffer to a file atomically (write to .tmp, then rename).
pub fn write_png_file(path: &std::path::Path, png_bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("png.tmp");
    std::fs::write(&tmp, png_bytes).map_err(|e| format!("PNG write error: {e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("PNG rename error: {e}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_1x1_red_pixel_produces_valid_png() {
        let pixels = [255u8, 0, 0, 255]; // RGBA red
        let result = encode_png(&pixels, 1, 1);
        assert!(result.is_ok());
        let bytes = result.unwrap();
        // PNG magic bytes
        assert_eq!(&bytes[0..8], &[137, 80, 78, 71, 13, 10, 26, 10]);
    }

    #[test]
    fn encode_2x2_transparent_produces_valid_png() {
        let pixels = vec![0u8; 2 * 2 * 4];
        let result = encode_png(&pixels, 2, 2);
        assert!(result.is_ok());
    }
}
