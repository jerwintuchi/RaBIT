use super::dto::SheetLayout;
use crate::project_io::dto::{ProjectDto, TagDto};
use serde_json::{json, Value};

pub struct SheetGeometry {
    pub sheet_w: u32,
    pub sheet_h: u32,
    /// (x, y) top-left offset for each frame in the sheet.
    pub offsets: Vec<(u32, u32)>,
}

/// Compute sheet dimensions and per-frame offsets for the chosen layout.
pub fn compute_layout(
    frame_w: u32,
    frame_h: u32,
    frame_count: u32,
    layout: &SheetLayout,
    padding: u32,
) -> SheetGeometry {
    match layout {
        SheetLayout::Horizontal => {
            let sheet_w = frame_w * frame_count + padding * frame_count.saturating_sub(1);
            let sheet_h = frame_h;
            let offsets = (0..frame_count)
                .map(|i| (i * (frame_w + padding), 0))
                .collect();
            SheetGeometry {
                sheet_w,
                sheet_h,
                offsets,
            }
        }
        SheetLayout::Vertical => {
            let sheet_w = frame_w;
            let sheet_h = frame_h * frame_count + padding * frame_count.saturating_sub(1);
            let offsets = (0..frame_count)
                .map(|i| (0, i * (frame_h + padding)))
                .collect();
            SheetGeometry {
                sheet_w,
                sheet_h,
                offsets,
            }
        }
        SheetLayout::Grid { columns } => {
            let cols = (*columns).max(1).min(frame_count);
            let rows = frame_count.div_ceil(cols);
            let sheet_w = frame_w * cols + padding * cols.saturating_sub(1);
            let sheet_h = frame_h * rows + padding * rows.saturating_sub(1);
            let offsets = (0..frame_count)
                .map(|i| {
                    let col = i % cols;
                    let row = i / cols;
                    (col * (frame_w + padding), row * (frame_h + padding))
                })
                .collect();
            SheetGeometry {
                sheet_w,
                sheet_h,
                offsets,
            }
        }
    }
}

/// Blit a frame buffer into the sheet buffer at the given offset.
pub fn blit_frame(
    sheet: &mut [u8],
    sheet_w: u32,
    frame: &[u8],
    frame_w: u32,
    frame_h: u32,
    ox: u32,
    oy: u32,
) {
    for row in 0..frame_h as usize {
        let src_start = row * frame_w as usize * 4;
        let dst_start = ((oy as usize + row) * sheet_w as usize + ox as usize) * 4;
        let len = frame_w as usize * 4;
        sheet[dst_start..dst_start + len].copy_from_slice(&frame[src_start..src_start + len]);
    }
}

/// Build the full sheet RGBA buffer from individual composited+upscaled frames.
pub fn build_sheet(
    frames: &[Vec<u8>],
    frame_w: u32,
    frame_h: u32,
    layout: &SheetLayout,
    padding: u32,
) -> (Vec<u8>, SheetGeometry) {
    let frame_count = frames.len() as u32;
    let geo = compute_layout(frame_w, frame_h, frame_count, layout, padding);
    let mut sheet = vec![0u8; geo.sheet_w as usize * geo.sheet_h as usize * 4];

    for (i, frame) in frames.iter().enumerate() {
        let (ox, oy) = geo.offsets[i];
        blit_frame(&mut sheet, geo.sheet_w, frame, frame_w, frame_h, ox, oy);
    }

    (sheet, geo)
}

/// Assemble the sidecar JSON per data-model §6.3.
pub fn build_sidecar_json(
    image_filename: &str,
    geo: &SheetGeometry,
    frame_w: u32,
    frame_h: u32,
    project: &ProjectDto,
    scale: u32,
) -> Value {
    let frame_count = geo.offsets.len();

    let frames: Vec<Value> = geo
        .offsets
        .iter()
        .enumerate()
        .map(|(i, &(x, y))| {
            let duration = project.frames.get(i).map(|f| f.duration).unwrap_or(100);
            json!({
                "index": i,
                "x": x,
                "y": y,
                "w": frame_w,
                "h": frame_h,
                "duration": duration,
            })
        })
        .collect();

    let tags: Vec<Value> = project
        .tags
        .iter()
        .map(|t: &TagDto| {
            json!({
                "name": t.name,
                "from": t.from,
                "to": t.to,
            })
        })
        .collect();

    json!({
        "image": image_filename,
        "width": geo.sheet_w,
        "height": geo.sheet_h,
        "frameCount": frame_count,
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "scale": scale,
        "frames": frames,
        "tags": tags,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn horizontal_layout_correct_dimensions() {
        let geo = compute_layout(16, 16, 4, &SheetLayout::Horizontal, 2);
        assert_eq!(geo.sheet_w, 16 * 4 + 2 * 3); // 70
        assert_eq!(geo.sheet_h, 16);
        assert_eq!(geo.offsets[0], (0, 0));
        assert_eq!(geo.offsets[1], (18, 0));
    }

    #[test]
    fn vertical_layout_correct_dimensions() {
        let geo = compute_layout(16, 16, 3, &SheetLayout::Vertical, 0);
        assert_eq!(geo.sheet_w, 16);
        assert_eq!(geo.sheet_h, 48);
        assert_eq!(geo.offsets[2], (0, 32));
    }

    #[test]
    fn grid_layout_correct_dimensions() {
        let geo = compute_layout(8, 8, 6, &SheetLayout::Grid { columns: 3 }, 0);
        assert_eq!(geo.sheet_w, 24);
        assert_eq!(geo.sheet_h, 16);
        assert_eq!(geo.offsets[3], (0, 8)); // row 1, col 0
        assert_eq!(geo.offsets[5], (16, 8)); // row 1, col 2
    }

    #[test]
    fn single_frame_horizontal_no_padding() {
        let geo = compute_layout(32, 32, 1, &SheetLayout::Horizontal, 4);
        assert_eq!(geo.sheet_w, 32);
        assert_eq!(geo.sheet_h, 32);
    }
}
