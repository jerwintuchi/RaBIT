use super::error::IoError;
use std::io::{Read, Write};

pub const MAGIC: [u8; 4] = *b"RBIT";
pub const FORMAT_MAJOR: u16 = 1;
pub const FORMAT_MINOR: u16 = 0;
pub const HEADER_SIZE: usize = 32;

#[derive(Debug, Clone)]
pub struct RabitHeader {
    pub major: u16,
    pub minor: u16,
    pub flags: u32,
    pub uncompressed_size: u64,
    pub compressed_size: u64,
    pub checksum: u32,
}

/// Computes Adler-32 checksum — fast integrity check, no external dep.
pub fn adler32(data: &[u8]) -> u32 {
    const MOD: u32 = 65521;
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % MOD;
        b = (b + a) % MOD;
    }
    (b << 16) | a
}

/// Layout (32 bytes total):
///  0– 3: magic "RBIT"
///  4– 5: major version (u16 LE)
///  6– 7: minor version (u16 LE)
///  8–11: flags (u32 LE, reserved)
/// 12–19: uncompressed body size (u64 LE)
/// 20–27: compressed body size (u64 LE)
/// 28–31: Adler-32 checksum of compressed body (u32 LE)
pub fn write_header<W: Write>(w: &mut W, h: &RabitHeader) -> std::io::Result<()> {
    w.write_all(&MAGIC)?;
    w.write_all(&h.major.to_le_bytes())?;
    w.write_all(&h.minor.to_le_bytes())?;
    w.write_all(&h.flags.to_le_bytes())?;
    w.write_all(&h.uncompressed_size.to_le_bytes())?;
    w.write_all(&h.compressed_size.to_le_bytes())?;
    w.write_all(&h.checksum.to_le_bytes())?;
    Ok(())
}

pub fn read_header<R: Read>(r: &mut R) -> Result<RabitHeader, IoError> {
    let mut buf = [0u8; HEADER_SIZE];
    r.read_exact(&mut buf)
        .map_err(|_| IoError::CorruptFile("file too short to contain a valid header".into()))?;

    if &buf[0..4] != &MAGIC {
        return Err(IoError::BadMagic);
    }

    let major = u16::from_le_bytes([buf[4], buf[5]]);
    let minor = u16::from_le_bytes([buf[6], buf[7]]);
    let flags = u32::from_le_bytes([buf[8], buf[9], buf[10], buf[11]]);
    let uncompressed_size = u64::from_le_bytes(buf[12..20].try_into().unwrap());
    let compressed_size = u64::from_le_bytes(buf[20..28].try_into().unwrap());
    let checksum = u32::from_le_bytes([buf[28], buf[29], buf[30], buf[31]]);

    if major > FORMAT_MAJOR {
        return Err(IoError::UnsupportedMajorVersion(major));
    }

    Ok(RabitHeader {
        major,
        minor,
        flags,
        uncompressed_size,
        compressed_size,
        checksum,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn header_roundtrip() {
        let original = RabitHeader {
            major: 1,
            minor: 0,
            flags: 0,
            uncompressed_size: 12345,
            compressed_size: 6789,
            checksum: 0xdeadbeef,
        };
        let mut buf = Vec::new();
        write_header(&mut buf, &original).unwrap();
        assert_eq!(buf.len(), HEADER_SIZE);

        let parsed = read_header(&mut Cursor::new(&buf)).unwrap();
        assert_eq!(parsed.major, original.major);
        assert_eq!(parsed.uncompressed_size, original.uncompressed_size);
        assert_eq!(parsed.checksum, original.checksum);
    }

    #[test]
    fn bad_magic_rejected() {
        let mut buf = vec![0u8; HEADER_SIZE];
        buf[0..4].copy_from_slice(b"NOPE");
        assert!(matches!(
            read_header(&mut Cursor::new(&buf)),
            Err(IoError::BadMagic)
        ));
    }

    #[test]
    fn newer_major_version_rejected() {
        let h = RabitHeader {
            major: 99,
            minor: 0,
            flags: 0,
            uncompressed_size: 0,
            compressed_size: 0,
            checksum: 0,
        };
        let mut buf = Vec::new();
        write_header(&mut buf, &h).unwrap();
        assert!(matches!(
            read_header(&mut Cursor::new(&buf)),
            Err(IoError::UnsupportedMajorVersion(99))
        ));
    }

    #[test]
    fn adler32_empty_input() {
        assert_eq!(adler32(&[]), 1);
    }

    #[test]
    fn adler32_known_value() {
        // "abc" → Adler-32 = 0x00e60038 per spec
        assert_eq!(adler32(b"abc"), 0x00e60038);
    }
}
