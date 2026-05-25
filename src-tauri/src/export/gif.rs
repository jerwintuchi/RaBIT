use super::composite::{composite_frame, upscale};
use crate::project_io::dto::ProjectDto;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GifExportOptions {
    pub project: ProjectDto,
    /// Integer upscale factor — 1 | 2 | 4.
    pub scale: u32,
    /// 0 = loop forever, n = loop n times.
    pub loop_count: u16,
    /// Ordered dithering for better perceived quality.
    pub dither: bool,
    /// Absolute output path including filename.
    pub output_path: String,
}

/// Encode all frames of the project into a GIF and return raw bytes.
pub fn encode_gif(options: &GifExportOptions) -> Result<Vec<u8>, String> {
    let project = &options.project;
    let scale = options.scale.clamp(1, 4);
    let frame_count = project.frames.len();

    if frame_count == 0 {
        return Err("No frames to export".into());
    }

    let src_w = project.canvas.width;
    let src_h = project.canvas.height;
    let dst_w = (src_w * scale) as u16;
    let dst_h = (src_h * scale) as u16;

    let mut out: Vec<u8> = Vec::new();

    {
        let mut encoder = gif::Encoder::new(&mut out, dst_w, dst_h, &[])
            .map_err(|e| format!("GIF encoder init failed: {e}"))?;

        encoder
            .set_repeat(if options.loop_count == 0 {
                gif::Repeat::Infinite
            } else {
                gif::Repeat::Finite(options.loop_count)
            })
            .map_err(|e| format!("GIF set repeat failed: {e}"))?;

        for frame_idx in 0..frame_count {
            let rgba = composite_frame(project, frame_idx, true);
            let scaled = upscale(&rgba, src_w, src_h, scale);

            let (palette, indices) =
                quantize_frame(&scaled, dst_w as usize, dst_h as usize, options.dither)?;

            // FrameDto.duration is in ms; GIF delay unit = 10ms
            let duration_ms = project.frames[frame_idx].duration;
            let delay = ((duration_ms).max(10) / 10) as u16;

            let mut frame = gif::Frame::default();
            frame.width = dst_w;
            frame.height = dst_h;
            frame.delay = delay;
            frame.dispose = gif::DisposalMethod::Background;
            frame.palette = Some(palette);
            frame.buffer = std::borrow::Cow::Owned(indices);
            frame.transparent = Some(0); // palette index 0 = transparent

            encoder
                .write_frame(&frame)
                .map_err(|e| format!("GIF write frame {frame_idx} failed: {e}"))?;
        }
    }

    Ok(out)
}

/// Quantize a single RGBA frame → flat RGB palette + indexed pixel buffer.
/// Palette index 0 is reserved for fully-transparent pixels.
fn quantize_frame(
    rgba: &[u8],
    width: usize,
    height: usize,
    dither: bool,
) -> Result<(Vec<u8>, Vec<u8>), String> {
    let pixel_count = width * height;
    assert_eq!(rgba.len(), pixel_count * 4);

    let mut liq = imagequant::new();
    liq.set_quality(60, 95)
        .map_err(|e| format!("imagequant quality: {e}"))?;
    liq.set_max_colors(255)
        .map_err(|e| format!("imagequant max_colors: {e}"))?;

    let pixels: Vec<imagequant::RGBA> = rgba
        .chunks_exact(4)
        .map(|p| imagequant::RGBA { r: p[0], g: p[1], b: p[2], a: p[3] })
        .collect();

    let mut img = liq
        .new_image(&pixels[..], width, height, 0.0)
        .map_err(|e| format!("imagequant new_image: {e}"))?;

    let mut res = liq
        .quantize(&mut img)
        .map_err(|e| format!("imagequant quantize: {e}"))?;

    if dither {
        res.set_dithering_level(1.0)
            .map_err(|e| format!("imagequant dither: {e}"))?;
    }

    let (palette, indices) = res
        .remapped(&mut img)
        .map_err(|e| format!("imagequant remap: {e}"))?;

    // Build flat RGB palette with 256 slots; slot 0 = transparent placeholder
    let mut palette_rgb = vec![0u8; 256 * 3];
    for (i, color) in palette.iter().enumerate() {
        let slot = i + 1; // shift by 1 to reserve slot 0 for transparency
        if slot < 256 {
            palette_rgb[slot * 3] = color.r;
            palette_rgb[slot * 3 + 1] = color.g;
            palette_rgb[slot * 3 + 2] = color.b;
        }
    }

    // Shift all indices up by 1; fully-transparent pixels → 0
    let shifted: Vec<u8> = indices
        .iter()
        .zip(rgba.chunks_exact(4))
        .map(|(&idx, px)| {
            if px[3] == 0 {
                0
            } else {
                (idx as usize + 1).min(255) as u8
            }
        })
        .collect();

    Ok((palette_rgb, shifted))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project_io::dto::{
        CanvasConfigDto, FrameDto, LayerDto, PaletteDto, PanOffsetDto, ProjectDto,
    };
    use std::collections::HashMap;

    fn make_project() -> ProjectDto {
        ProjectDto {
            schema_version: 1,
            project_id: "test".into(),
            name: "test".into(),
            author: None,
            created_at: 0,
            modified_at: 0,
            application: "rabit".into(),
            canvas: CanvasConfigDto {
                width: 2,
                height: 2,
                color_mode: "rgba".into(),
                background_color: 0,
                dpi: 72,
            },
            layers: vec![LayerDto {
                id: "l1".into(),
                name: "Layer 1".into(),
                visible: true,
                locked: false,
                opacity: 1.0,
                blend_mode: "normal".into(),
            }],
            frames: vec![
                FrameDto { id: "f1".into(), duration: 100, cells: HashMap::new() },
                FrameDto { id: "f2".into(), duration: 200, cells: HashMap::new() },
            ],
            palette: PaletteDto {
                id: "p1".into(),
                name: "Default".into(),
                swatches: vec![],
            },
            tags: vec![],
            active_layer_id: Some("l1".into()),
            active_frame_index: 0,
            zoom_level: 1.0,
            pan_offset: PanOffsetDto { x: 0.0, y: 0.0 },
        }
    }

    #[test]
    fn gif_output_starts_with_magic() {
        let options = GifExportOptions {
            project: make_project(),
            scale: 1,
            loop_count: 0,
            dither: false,
            output_path: "/tmp/test.gif".into(),
        };
        let bytes = encode_gif(&options).expect("encode_gif failed");
        assert!(bytes.starts_with(b"GIF89a"), "expected GIF89a magic");
        assert!(bytes.len() > 20);
    }

    #[test]
    fn gif_respects_scale() {
        // 2× scale on 2×2 canvas → 4×4 logical dims in GIF header
        let options = GifExportOptions {
            project: make_project(),
            scale: 2,
            loop_count: 0,
            dither: false,
            output_path: "/tmp/test2x.gif".into(),
        };
        let bytes = encode_gif(&options).expect("encode_gif 2x failed");
        // GIF header bytes 6-7 = logical width (little-endian u16)
        let w = u16::from_le_bytes([bytes[6], bytes[7]]);
        let h = u16::from_le_bytes([bytes[8], bytes[9]]);
        assert_eq!(w, 4);
        assert_eq!(h, 4);
    }
}
