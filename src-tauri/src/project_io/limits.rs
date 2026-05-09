use super::error::IoError;

pub const MAX_CANVAS_DIM: u32 = 4096;
pub const MAX_LAYERS: usize = 256;
pub const MAX_FRAMES: usize = 10_000;
#[allow(dead_code)]
pub const MAX_PALETTE_SWATCHES: usize = 65_535;

pub fn check_limits(
    width: u32,
    height: u32,
    layer_count: usize,
    frame_count: usize,
) -> Result<(), IoError> {
    if width > MAX_CANVAS_DIM || height > MAX_CANVAS_DIM {
        return Err(IoError::CanvasTooLarge { width, height });
    }
    if layer_count > MAX_LAYERS {
        return Err(IoError::TooManyLayers(layer_count));
    }
    if frame_count > MAX_FRAMES {
        return Err(IoError::TooManyFrames(frame_count));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_project_passes() {
        assert!(check_limits(32, 32, 4, 24).is_ok());
    }

    #[test]
    fn exactly_at_limits_passes() {
        assert!(check_limits(4096, 4096, 256, 10_000).is_ok());
    }

    #[test]
    fn oversized_width_fails() {
        assert!(matches!(
            check_limits(4097, 32, 1, 1),
            Err(IoError::CanvasTooLarge { width: 4097, .. })
        ));
    }

    #[test]
    fn oversized_height_fails() {
        assert!(matches!(
            check_limits(32, 4097, 1, 1),
            Err(IoError::CanvasTooLarge { height: 4097, .. })
        ));
    }

    #[test]
    fn too_many_layers_fails() {
        assert!(matches!(
            check_limits(32, 32, 257, 1),
            Err(IoError::TooManyLayers(257))
        ));
    }

    #[test]
    fn too_many_frames_fails() {
        assert!(matches!(
            check_limits(32, 32, 1, 10_001),
            Err(IoError::TooManyFrames(10_001))
        ));
    }
}
