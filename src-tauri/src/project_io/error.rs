use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum IoError {
    #[error("canvas size {width}×{height} exceeds the 4096×4096 maximum")]
    CanvasTooLarge { width: u32, height: u32 },

    #[error("file has {0} layers, exceeding the 256-layer limit")]
    TooManyLayers(usize),

    #[error("file has {0} frames, exceeding the 10,000-frame limit")]
    TooManyFrames(usize),

    #[error("not a RaBIT file (invalid header)")]
    BadMagic,

    #[error("file was created by a newer version of RaBIT (format v{0}) — please update the app")]
    UnsupportedMajorVersion(u16),

    #[error("file is corrupt or incomplete: {0}")]
    CorruptFile(String),

    #[error("file checksum verification failed — the file may be damaged")]
    ChecksumMismatch,

    #[error("no migration path from format v{from} to v{to}: {reason}")]
    MigrationFailed { from: u16, to: u16, reason: String },

    #[error("disk is full — free up space and try again")]
    DiskFull,

    #[error("permission denied: {0}")]
    PermissionDenied(PathBuf),

    #[error("path is not in an allowed location")]
    PathNotAllowed,

    #[error("io error: {0}")]
    Io(std::io::Error),
}

/// Maps std::io::Error kinds to semantic IoError variants.
pub fn classify_io_error(e: std::io::Error, path: &std::path::Path) -> IoError {
    match e.kind() {
        std::io::ErrorKind::PermissionDenied => IoError::PermissionDenied(path.to_path_buf()),
        std::io::ErrorKind::StorageFull => IoError::DiskFull,
        _ => IoError::Io(e),
    }
}

// Tauri commands return Result<T, String> — this lets IoError convert automatically.
impl From<IoError> for String {
    fn from(e: IoError) -> String {
        e.to_string()
    }
}
