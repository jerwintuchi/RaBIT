use super::{
    dto::ProjectDto,
    error::{classify_io_error, IoError},
    format::{adler32, write_header, RabitHeader, FORMAT_MAJOR, FORMAT_MINOR},
};
use std::{
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

/// Serializes `project` and writes it atomically to `path`.
///
/// Sequence:
/// 1. Serialize to MessagePack
/// 2. Compress with zstd
/// 3. Write header + body to `path.rabit.tmp`
/// 4. Verify the tmp file (re-read header + checksum)
/// 5. Rename tmp → path (atomic on all supported platforms)
pub fn atomic_write(path: &Path, project: &ProjectDto) -> Result<(), IoError> {
    // 1. Serialize to MessagePack
    let msgpack_bytes =
        rmp_serde::to_vec_named(project).map_err(|e| IoError::CorruptFile(e.to_string()))?;

    // 2. Compress with zstd (level 3 — good balance of speed and ratio)
    let compressed =
        zstd::encode_all(msgpack_bytes.as_slice(), 3).map_err(|e| classify_io_error(e, path))?;

    let checksum = adler32(&compressed);

    let header = RabitHeader {
        major: FORMAT_MAJOR,
        minor: FORMAT_MINOR,
        flags: 0,
        uncompressed_size: msgpack_bytes.len() as u64,
        compressed_size: compressed.len() as u64,
        checksum,
    };

    // 3. Write to .tmp
    let tmp_path = tmp_path_for(path);
    {
        let mut file =
            std::fs::File::create(&tmp_path).map_err(|e| classify_io_error(e, &tmp_path))?;
        write_header(&mut file, &header).map_err(|e| classify_io_error(e, &tmp_path))?;
        file.write_all(&compressed)
            .map_err(|e| classify_io_error(e, &tmp_path))?;
        file.flush().map_err(|e| classify_io_error(e, &tmp_path))?;
    }

    // 4. Verify: re-read the tmp file and check checksum
    verify_tmp(&tmp_path, &header)?;

    // 5. Atomic rename
    std::fs::rename(&tmp_path, path).map_err(|e| {
        // Best-effort cleanup of .tmp on rename failure
        let _ = std::fs::remove_file(&tmp_path);
        classify_io_error(e, path)
    })?;

    Ok(())
}

fn tmp_path_for(path: &Path) -> std::path::PathBuf {
    let mut tmp = path.to_path_buf();
    let stem = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    tmp.set_file_name(format!("{stem}.tmp"));
    tmp
}

fn verify_tmp(tmp_path: &Path, expected: &RabitHeader) -> Result<(), IoError> {
    use super::format::read_header;
    use std::io::Read;

    let mut file = std::fs::File::open(tmp_path).map_err(|e| classify_io_error(e, tmp_path))?;

    let header = read_header(&mut file)?;

    if header.compressed_size != expected.compressed_size
        || header.uncompressed_size != expected.uncompressed_size
    {
        return Err(IoError::ChecksumMismatch);
    }

    let mut body = Vec::with_capacity(header.compressed_size as usize);
    file.read_to_end(&mut body)
        .map_err(|e| classify_io_error(e, tmp_path))?;

    if adler32(&body) != header.checksum {
        return Err(IoError::ChecksumMismatch);
    }

    Ok(())
}

pub fn unix_ms_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project_io::dto::*;
    use std::collections::HashMap;

    fn minimal_project() -> ProjectDto {
        ProjectDto {
            schema_version: 1,
            project_id: "test123".into(),
            name: "Test".into(),
            author: None,
            created_at: 0,
            modified_at: 0,
            application: "RaBIT 0.1.0".into(),
            canvas: CanvasConfigDto {
                width: 4,
                height: 4,
                color_mode: "rgba".into(),
                background_color: 0,
                dpi: 72,
            },
            layers: vec![LayerDto {
                id: "layer1".into(),
                name: "Layer 1".into(),
                visible: true,
                locked: false,
                opacity: 1.0,
                blend_mode: "normal".into(),
            }],
            frames: vec![FrameDto {
                id: "frame1".into(),
                duration: 100,
                cells: {
                    let mut m = HashMap::new();
                    m.insert(
                        "layer1".into(),
                        CellDto {
                            linked: false,
                            data: Some(vec![0u8; 4 * 4 * 4]),
                        },
                    );
                    m
                },
            }],
            palette: PaletteDto {
                id: "pal1".into(),
                name: "Default".into(),
                swatches: vec![],
            },
            tags: vec![],
            active_layer_id: Some("layer1".into()),
            active_frame_index: 0,
            zoom_level: 1.0,
            pan_offset: PanOffsetDto { x: 0.0, y: 0.0 },
        }
    }

    #[test]
    fn atomic_write_creates_file_and_removes_tmp() {
        let dir = std::env::temp_dir();
        let path = dir.join("rabit_test_write.rabit");
        let tmp = dir.join("rabit_test_write.rabit.tmp");

        let project = minimal_project();
        atomic_write(&path, &project).expect("atomic_write failed");

        assert!(path.exists(), ".rabit file should exist");
        assert!(!tmp.exists(), ".tmp file should be gone");

        let _ = std::fs::remove_file(&path);
    }
}
