use super::{
    dto::ProjectDto,
    error::{classify_io_error, IoError},
    format::{adler32, read_header, FORMAT_MAJOR},
    limits::check_limits,
    migration::migrate,
};
use std::{io::Read, path::Path};

/// Reads and deserializes a `.rabit` file from `path`.
///
/// Steps:
/// 1. Read and validate the 32-byte header
/// 2. Run migration pipeline if format version is older than current
/// 3. Read and decompress the body
/// 4. Verify Adler-32 checksum
/// 5. Deserialize MessagePack → ProjectDto
/// 6. Enforce hard limits before returning
pub fn read_project(path: &Path) -> Result<ProjectDto, IoError> {
    let mut file = std::fs::File::open(path).map_err(|e| classify_io_error(e, path))?;

    let header = read_header(&mut file)?;

    // Read compressed body
    let mut compressed = Vec::with_capacity(header.compressed_size as usize);
    file.read_to_end(&mut compressed)
        .map_err(|e| classify_io_error(e, path))?;

    // Verify checksum before allocating decompression buffer
    if adler32(&compressed) != header.checksum {
        return Err(IoError::ChecksumMismatch);
    }

    // Decompress
    let msgpack_bytes = zstd::decode_all(compressed.as_slice())
        .map_err(|e| IoError::CorruptFile(format!("decompression failed: {e}")))?;

    // Migration: if older format, transform the raw msgpack value then re-deserialize
    let dto: ProjectDto = if header.major < FORMAT_MAJOR {
        let raw: rmpv::Value = rmpv::decode::read_value(&mut msgpack_bytes.as_slice())
            .map_err(|e| IoError::CorruptFile(format!("msgpack parse failed: {e}")))?;

        let migrated = migrate(raw, header.major, FORMAT_MAJOR)?;

        // Re-serialize migrated value then deserialize as typed DTO
        let mut re_encoded = Vec::new();
        rmpv::encode::write_value(&mut re_encoded, &migrated)
            .map_err(|e| IoError::CorruptFile(format!("re-encode after migration failed: {e}")))?;

        rmp_serde::from_slice(&re_encoded)
            .map_err(|e| IoError::CorruptFile(format!("deserialize after migration failed: {e}")))?
    } else {
        rmp_serde::from_slice(&msgpack_bytes)
            .map_err(|e| IoError::CorruptFile(format!("msgpack deserialize failed: {e}")))?
    };

    // Enforce hard limits before handing data to TypeScript
    check_limits(
        dto.canvas.width,
        dto.canvas.height,
        dto.layers.len(),
        dto.frames.len(),
    )?;

    Ok(dto)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project_io::{dto::*, serialize::atomic_write};
    use std::collections::HashMap;

    fn minimal_project() -> ProjectDto {
        ProjectDto {
            schema_version: 1,
            project_id: "roundtrip".into(),
            name: "Roundtrip Test".into(),
            author: None,
            created_at: 1000,
            modified_at: 2000,
            application: "RaBIT 0.1.0".into(),
            canvas: CanvasConfigDto {
                width: 8,
                height: 8,
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
            frames: vec![FrameDto {
                id: "f1".into(),
                duration: 100,
                cells: {
                    let mut m = HashMap::new();
                    m.insert(
                        "l1".into(),
                        CellDto {
                            linked: false,
                            data: Some(vec![255u8; 8 * 8 * 4]),
                        },
                    );
                    m
                },
            }],
            palette: PaletteDto {
                id: "p1".into(),
                name: "Palette".into(),
                swatches: vec![SwatchDto {
                    color: 0xff0000ff,
                    name: None,
                }],
            },
            tags: vec![],
            active_layer_id: Some("l1".into()),
            active_frame_index: 0,
            zoom_level: 2.0,
            pan_offset: PanOffsetDto { x: 10.0, y: 20.0 },
        }
    }

    #[test]
    fn roundtrip_is_identical() {
        let dir = std::env::temp_dir();
        let path = dir.join("rabit_roundtrip_test.rabit");

        let original = minimal_project();
        atomic_write(&path, &original).unwrap();

        let loaded = read_project(&path).unwrap();

        assert_eq!(loaded.project_id, original.project_id);
        assert_eq!(loaded.name, original.name);
        assert_eq!(loaded.canvas.width, original.canvas.width);
        assert_eq!(loaded.layers.len(), original.layers.len());
        assert_eq!(loaded.frames.len(), original.frames.len());
        assert_eq!(loaded.pan_offset.x, original.pan_offset.x);

        let orig_cell = original.frames[0].cells.get("l1").unwrap();
        let load_cell = loaded.frames[0].cells.get("l1").unwrap();
        assert_eq!(load_cell.data, orig_cell.data);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn corrupt_file_rejected() {
        let dir = std::env::temp_dir();
        let path = dir.join("rabit_corrupt_test.rabit");
        std::fs::write(&path, b"this is not a rabit file").unwrap();

        assert!(matches!(read_project(&path), Err(IoError::BadMagic)));
        let _ = std::fs::remove_file(&path);
    }
}
