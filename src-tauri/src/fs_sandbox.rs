use std::path::{Component, Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum SandboxError {
    #[error("path must be absolute")]
    NotAbsolute,
    #[error("path traversal detected")]
    PathTraversal,
    #[allow(dead_code)]
    #[error("path is not in an allowed location")]
    PathNotAllowed,
}

/// Validates a path for reading: must be absolute and contain no `..` traversal.
/// The native file dialog guarantees user-selected paths, so allowlist enforcement
/// is handled by the OS. This catches programmatic traversal attempts.
pub fn safe_read_path(requested: &Path) -> Result<PathBuf, SandboxError> {
    if !requested.is_absolute() {
        return Err(SandboxError::NotAbsolute);
    }
    for component in requested.components() {
        if component == Component::ParentDir {
            return Err(SandboxError::PathTraversal);
        }
    }
    Ok(requested.to_path_buf())
}

/// Validates a path for writing. Same rules as `safe_read_path`.
pub fn safe_write_path(requested: &Path) -> Result<PathBuf, SandboxError> {
    safe_read_path(requested)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_absolute_path_accepted() {
        #[cfg(windows)]
        let p = Path::new(r"C:\Users\test\sprite.rabit");
        #[cfg(not(windows))]
        let p = Path::new("/home/user/sprite.rabit");
        assert!(safe_read_path(p).is_ok());
    }

    #[test]
    fn relative_path_rejected() {
        let p = Path::new("relative/path.rabit");
        assert!(matches!(safe_read_path(p), Err(SandboxError::NotAbsolute)));
    }

    #[test]
    fn traversal_rejected() {
        #[cfg(windows)]
        let p = Path::new(r"C:\Users\test\..\..\Windows\system32\cmd.exe");
        #[cfg(not(windows))]
        let p = Path::new("/home/user/../../etc/passwd");
        assert!(matches!(
            safe_read_path(p),
            Err(SandboxError::PathTraversal)
        ));
    }

    #[test]
    fn write_delegates_to_read_rules() {
        let p = Path::new("bad/relative");
        assert!(matches!(safe_write_path(p), Err(SandboxError::NotAbsolute)));
    }
}
