use super::error::IoError;

/// Applies any necessary migrations to upgrade `data` from `from_major` to
/// `FORMAT_MAJOR`. Each migration step is a function that transforms the opaque
/// MessagePack value in-place.
///
/// v1 is the first format version — no migrations exist yet. This stub provides
/// the chain for future v2+ migrations without changing callers.
pub fn migrate(data: rmpv::Value, from_major: u16, to_major: u16) -> Result<rmpv::Value, IoError> {
    if from_major == to_major {
        return Ok(data);
    }

    // Future migrations slot in here:
    // let mut value = data;
    // let mut version = from_major;
    // if version == 1 { value = migrate_v1_to_v2(value)?; version = 2; }
    // if version == to_major { return Ok(value); }

    Err(IoError::MigrationFailed {
        from: from_major,
        to: to_major,
        reason: "no migration path available".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_version_is_noop() {
        let value = rmpv::Value::String("test".into());
        let result = migrate(value.clone(), 1, 1).unwrap();
        assert_eq!(result, value);
    }

    #[test]
    fn different_version_returns_error() {
        let value = rmpv::Value::Nil;
        assert!(matches!(
            migrate(value, 0, 1),
            Err(IoError::MigrationFailed { from: 0, to: 1, .. })
        ));
    }
}
