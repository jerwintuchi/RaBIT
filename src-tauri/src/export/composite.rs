use crate::project_io::dto::{FrameDto, ProjectDto};

// ── Linked-cell resolution ────────────────────────────────────────────────────

pub fn resolve_cell<'a>(
    frames: &'a [FrameDto],
    frame_idx: usize,
    layer_id: &str,
) -> Option<&'a [u8]> {
    let mut idx = frame_idx as i32;
    while idx >= 0 {
        let frame = frames.get(idx as usize)?;
        if let Some(cell) = frame.cells.get(layer_id) {
            if cell.linked {
                idx -= 1;
                continue;
            }
            return cell.data.as_deref().filter(|d| !d.is_empty());
        }
        idx -= 1;
    }
    None
}

// ── Per-pixel blend ───────────────────────────────────────────────────────────

#[inline]
fn apply_opacity(pixel: [u8; 4], opacity: f64) -> [u8; 4] {
    let a = (pixel[3] as f64 * opacity.clamp(0.0, 1.0)) as u8;
    [pixel[0], pixel[1], pixel[2], a]
}

/// Blend modes resolved from layer string once per layer, not per pixel.
#[derive(Clone, Copy)]
enum BlendMode {
    Normal,
    Multiply,
    Screen,
    Overlay,
    Add,
    Subtract,
}

impl BlendMode {
    fn from_str(s: &str) -> Self {
        match s {
            "multiply" => Self::Multiply,
            "screen" => Self::Screen,
            "overlay" => Self::Overlay,
            "add" => Self::Add,
            "subtract" => Self::Subtract,
            _ => Self::Normal,
        }
    }
}

#[cfg(test)]
pub fn blend_pixel(dst: [u8; 4], src: [u8; 4], blend_mode: &str) -> [u8; 4] {
    blend_pixel_mode(dst, src, BlendMode::from_str(blend_mode))
}

#[inline]
fn blend_pixel_mode(dst: [u8; 4], src: [u8; 4], mode: BlendMode) -> [u8; 4] {
    let src_a = src[3] as f64 / 255.0;
    if src_a == 0.0 {
        return dst;
    }

    let blended_rgb: [u8; 3] = match mode {
        BlendMode::Multiply => [
            blend_multiply(src[0], dst[0]),
            blend_multiply(src[1], dst[1]),
            blend_multiply(src[2], dst[2]),
        ],
        BlendMode::Screen => [
            blend_screen(src[0], dst[0]),
            blend_screen(src[1], dst[1]),
            blend_screen(src[2], dst[2]),
        ],
        BlendMode::Overlay => [
            blend_overlay(src[0], dst[0]),
            blend_overlay(src[1], dst[1]),
            blend_overlay(src[2], dst[2]),
        ],
        BlendMode::Add => [
            src[0].saturating_add(dst[0]),
            src[1].saturating_add(dst[1]),
            src[2].saturating_add(dst[2]),
        ],
        BlendMode::Subtract => [
            dst[0].saturating_sub(src[0]),
            dst[1].saturating_sub(src[1]),
            dst[2].saturating_sub(src[2]),
        ],
        BlendMode::Normal => [src[0], src[1], src[2]],
    };

    let dst_a = dst[3] as f64 / 255.0;
    let out_a = src_a + dst_a * (1.0 - src_a);
    if out_a == 0.0 {
        return [0, 0, 0, 0];
    }

    let composite = |s: u8, d: u8| -> u8 {
        ((s as f64 * src_a + d as f64 * dst_a * (1.0 - src_a)) / out_a).round() as u8
    };

    [
        composite(blended_rgb[0], dst[0]),
        composite(blended_rgb[1], dst[1]),
        composite(blended_rgb[2], dst[2]),
        (out_a * 255.0).round() as u8,
    ]
}

#[inline]
fn blend_multiply(s: u8, d: u8) -> u8 {
    ((s as u32 * d as u32) / 255) as u8
}

#[inline]
fn blend_screen(s: u8, d: u8) -> u8 {
    let s = s as u32;
    let d = d as u32;
    (255 - (255 - s) * (255 - d) / 255) as u8
}

#[inline]
fn blend_overlay(s: u8, d: u8) -> u8 {
    if d < 128 {
        ((2 * s as u32 * d as u32) / 255) as u8
    } else {
        (255 - (2 * (255 - s as u32) * (255 - d as u32)) / 255) as u8
    }
}

// ── Frame compositing ─────────────────────────────────────────────────────────

pub fn composite_frame(
    project: &ProjectDto,
    frame_idx: usize,
    include_background: bool,
) -> Vec<u8> {
    let w = project.canvas.width as usize;
    let h = project.canvas.height as usize;
    let pixel_count = w * h;
    let mut out = vec![0u8; pixel_count * 4];

    if include_background && project.canvas.background_color != 0 {
        let bg = unpack_rgba(project.canvas.background_color);
        for chunk in out.chunks_exact_mut(4) {
            chunk.copy_from_slice(&bg);
        }
    }

    for layer in &project.layers {
        if !layer.visible {
            continue;
        }
        let Some(data) = resolve_cell(&project.frames, frame_idx, &layer.id) else {
            continue;
        };
        if data.len() < pixel_count * 4 {
            continue;
        }

        // Resolve blend mode and clamp opacity once per layer, not per pixel
        let mode = BlendMode::from_str(&layer.blend_mode);
        let opacity = layer.opacity.clamp(0.0, 1.0);

        for i in 0..pixel_count {
            let o = i * 4;
            let src_raw = [data[o], data[o + 1], data[o + 2], data[o + 3]];
            let src = apply_opacity(src_raw, opacity);
            let dst = [out[o], out[o + 1], out[o + 2], out[o + 3]];
            let blended = blend_pixel_mode(dst, src, mode);
            out[o..o + 4].copy_from_slice(&blended);
        }
    }

    out
}

fn unpack_rgba(packed: u32) -> [u8; 4] {
    [
        ((packed >> 24) & 0xff) as u8,
        ((packed >> 16) & 0xff) as u8,
        ((packed >> 8) & 0xff) as u8,
        (packed & 0xff) as u8,
    ]
}

// ── Nearest-neighbour upscale ─────────────────────────────────────────────────

pub fn upscale(pixels: &[u8], src_w: u32, src_h: u32, scale: u32) -> Vec<u8> {
    if scale <= 1 {
        return pixels.to_vec();
    }
    let s = scale as usize;
    let dst_w = src_w as usize * s;
    let dst_h = src_h as usize * s;
    let mut out = vec![0u8; dst_w * dst_h * 4];

    for sy in 0..src_h as usize {
        for sx in 0..src_w as usize {
            let src_off = (sy * src_w as usize + sx) * 4;
            let px = &pixels[src_off..src_off + 4];

            // Fill one scaled row, then copy it for the remaining dy rows
            let row_start = (sy * s * dst_w + sx * s) * 4;
            for dx in 0..s {
                out[row_start + dx * 4..row_start + dx * 4 + 4].copy_from_slice(px);
            }
            let row_bytes = &out[row_start..row_start + s * 4].to_vec();
            for dy in 1..s {
                let dst_row = row_start + dy * dst_w * 4;
                out[dst_row..dst_row + s * 4].copy_from_slice(row_bytes);
            }
        }
    }
    out
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_blend_opaque_src_overwrites_dst() {
        let dst = [0, 0, 255, 255];
        let src = [255, 0, 0, 255];
        let out = blend_pixel(dst, src, "normal");
        assert_eq!(out, [255, 0, 0, 255]);
    }

    #[test]
    fn normal_blend_transparent_src_leaves_dst() {
        let dst = [0, 0, 255, 255];
        let src = [255, 0, 0, 0];
        let out = blend_pixel(dst, src, "normal");
        assert_eq!(out, dst);
    }

    #[test]
    fn multiply_black_gives_black() {
        let dst = [200, 100, 50, 255];
        let src = [0, 0, 0, 255];
        let out = blend_pixel(dst, src, "multiply");
        assert_eq!(out[..3], [0, 0, 0]);
    }

    #[test]
    fn upscale_2x_doubles_dimensions() {
        let pixels = vec![255u8, 0, 0, 255, 0, 255, 0, 255];
        let out = upscale(&pixels, 2, 1, 2);
        assert_eq!(out.len(), 4 * 2 * 4);
        assert_eq!(&out[0..4], &[255, 0, 0, 255]);
        assert_eq!(&out[4..8], &[255, 0, 0, 255]);
    }

    #[test]
    fn upscale_1x_returns_same() {
        let pixels = vec![1u8, 2, 3, 4];
        let out = upscale(&pixels, 1, 1, 1);
        assert_eq!(out, pixels);
    }
}
