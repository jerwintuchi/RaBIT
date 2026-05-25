use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeSelectionInput {
    /// Flat RGBA pixel buffer (width * height * 4 bytes).
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub start_x: u32,
    pub start_y: u32,
    /// 0–255: max color-channel distance for a pixel to be included.
    pub tolerance: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeSelectionResult {
    /// 1 byte per pixel: 1 = selected, 0 = not selected.
    pub mask: Vec<u8>,
    pub width: u32,
    pub height: u32,
    /// Bounding rect of the selection.
    pub bounds_x: u32,
    pub bounds_y: u32,
    pub bounds_w: u32,
    pub bounds_h: u32,
}

/// BFS flood-fill selection from (start_x, start_y) using color tolerance.
/// Used by MagicWandTool for canvases > 512×512 where JS BFS is too slow.
#[tauri::command]
pub fn compute_selection(input: ComputeSelectionInput) -> Result<ComputeSelectionResult, String> {
    let w = input.width as usize;
    let h = input.height as usize;
    let pixels = &input.pixels;

    if pixels.len() != w * h * 4 {
        return Err(format!(
            "pixel buffer size mismatch: expected {}, got {}",
            w * h * 4,
            pixels.len()
        ));
    }

    let sx = input.start_x as usize;
    let sy = input.start_y as usize;

    if sx >= w || sy >= h {
        return Err("start position out of bounds".into());
    }

    let seed_off = (sy * w + sx) * 4;
    let seed = [pixels[seed_off], pixels[seed_off + 1], pixels[seed_off + 2], pixels[seed_off + 3]];
    let tol = input.tolerance as i32;

    let mut mask = vec![0u8; w * h];
    let mut visited = vec![false; w * h];
    let mut queue: VecDeque<(usize, usize)> = VecDeque::new();

    queue.push_back((sx, sy));
    visited[sy * w + sx] = true;

    let mut min_x = sx;
    let mut max_x = sx;
    let mut min_y = sy;
    let mut max_y = sy;

    let seed_alpha = seed[3];

    while let Some((x, y)) = queue.pop_front() {
        let off = (y * w + x) * 4;
        let px = [pixels[off], pixels[off + 1], pixels[off + 2], pixels[off + 3]];

        // Alpha boundary: opaque seed stops at transparent pixels (and vice versa)
        if seed_alpha > 0 && px[3] == 0 { continue; }
        if seed_alpha == 0 && px[3] > 0 { continue; }

        if color_distance(seed, px) > tol {
            continue;
        }

        mask[y * w + x] = 1;
        min_x = min_x.min(x);
        max_x = max_x.max(x);
        min_y = min_y.min(y);
        max_y = max_y.max(y);

        for (nx, ny) in neighbors(x, y, w, h) {
            let idx = ny * w + nx;
            if !visited[idx] {
                visited[idx] = true;
                queue.push_back((nx, ny));
            }
        }
    }

    Ok(ComputeSelectionResult {
        mask,
        width: input.width,
        height: input.height,
        bounds_x: min_x as u32,
        bounds_y: min_y as u32,
        bounds_w: (max_x - min_x + 1) as u32,
        bounds_h: (max_y - min_y + 1) as u32,
    })
}

fn color_distance(a: [u8; 4], b: [u8; 4]) -> i32 {
    let dr = (a[0] as i32 - b[0] as i32).abs();
    let dg = (a[1] as i32 - b[1] as i32).abs();
    let db = (a[2] as i32 - b[2] as i32).abs();
    let da = (a[3] as i32 - b[3] as i32).abs();
    dr.max(dg).max(db).max(da)
}

fn neighbors(x: usize, y: usize, w: usize, h: usize) -> Vec<(usize, usize)> {
    let mut result = Vec::with_capacity(4);
    if x + 1 < w { result.push((x + 1, y)); }
    if y + 1 < h { result.push((x, y + 1)); }
    if x > 0    { result.push((x - 1, y)); }
    if y > 0    { result.push((x, y - 1)); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid_rgba(w: usize, h: usize, r: u8, g: u8, b: u8, a: u8) -> Vec<u8> {
        let mut px = vec![0u8; w * h * 4];
        for chunk in px.chunks_exact_mut(4) {
            chunk[0] = r; chunk[1] = g; chunk[2] = b; chunk[3] = a;
        }
        px
    }

    #[test]
    fn selects_full_solid_canvas() {
        let pixels = solid_rgba(4, 4, 255, 0, 0, 255);
        let res = compute_selection(ComputeSelectionInput {
            pixels,
            width: 4,
            height: 4,
            start_x: 0,
            start_y: 0,
            tolerance: 0,
        }).unwrap();
        assert!(res.mask.iter().all(|&v| v == 1));
        assert_eq!(res.bounds_w, 4);
        assert_eq!(res.bounds_h, 4);
    }

    #[test]
    fn tolerance_zero_selects_exact_color() {
        // 2×2: left column red, right column blue
        let mut pixels = vec![0u8; 4 * 4];
        // (0,0)
        pixels[0] = 255; pixels[3] = 255; // red
        // (1,0)
        pixels[4] = 0; pixels[6] = 255; pixels[7] = 255; // blue
        // (0,1)
        pixels[8] = 255; pixels[11] = 255; // red
        // (1,1)
        pixels[12] = 0; pixels[14] = 255; pixels[15] = 255; // blue

        let res = compute_selection(ComputeSelectionInput {
            pixels,
            width: 2,
            height: 2,
            start_x: 0,
            start_y: 0,
            tolerance: 0,
        }).unwrap();

        // Only red pixels (0,0) and (0,1) should be selected
        assert_eq!(res.mask[0], 1); // (0,0)
        assert_eq!(res.mask[1], 0); // (1,0)
        assert_eq!(res.mask[2], 1); // (0,1)
        assert_eq!(res.mask[3], 0); // (1,1)
    }
}
