---
name: File Format
description: .rabit binary format spec, in-memory data model, and migration strategy (Phase 5 output)
type: project
---

Full spec in `docs/data-model.md`. This file captures load-bearing decisions for future sessions.

## `.rabit` Binary Format (locked)

**32-byte fixed header, zstd-compressed MessagePack body.**

```
0– 3   "RBIT" magic bytes
4– 5   u16 LE major version (current: 1)
6– 7   u16 LE minor version (current: 0)
8–11   u32 LE flags (reserved, must be 0 in v1.0)
12–15  u32 LE extended header length (0 in v1.0)
16–23  u64 LE uncompressed body size
24–31  u64 LE compressed body size
32+    zstd frame (MessagePack body inside; zstd's XXH64 checksum provides integrity)
```

## Key Decisions (with rationale — do not re-litigate)

- **MessagePack over JSON for body** — binary-native, no base64 overhead for pixel buffers, direct `rmp-serde` support
- **zstd built-in checksum (XXH64), no separate hash** — redundant with a SHA/BLAKE would just slow writes without added value; we need corruption detection, not cryptographic signing
- **Full-canvas cells, no per-cell bounding box** — simpler math everywhere; memory covered by linked cells + zstd. Revisit in v2 if profiling shows it matters.
- **Linked cells store `{linked: true}` only, no pixel data** — runtime walks frames backward to find source cell for same layer
- **RGBA-only color mode for v1** — `indexed` deferred to v2
- **6 blend modes shipped** — normal, multiply, screen, overlay, add, subtract (all GPU shader-based)
- **History NOT in file format** — saved project = committed state, not a session; prevents file bloat and cross-session undo correctness issues
- **Auto-save uses same format** with `.rabit.autosave` extension + sidecar `autosave-manifest.json`
- **Preferences in TOML, NOT in project file** — platform app-data dir, user-editable

## Version Semantics

- **Major bump** = breaking change → older readers must reject
- **Minor bump** = additive, backward-compat → older readers load with best-effort, preserve unknown fields in `_forward` map, re-emit on save (lossless round-trip for future-version files)

## Hard Limits (security boundaries — enforce in Rust deserializer BEFORE allocation)

| Limit | Value |
|---|---|
| Max compressed file | 2 GB |
| Max uncompressed body | 8 GB (zstd bomb protection) |
| Max canvas dimension | 4096 |
| Max layers | 256 |
| Max frames | 10 000 |
| Max palette swatches | 65 535 |
| Max cells (layers × frames) | 1 000 000 |
| Max string field | 1024 UTF-8 bytes |

Violations → reject file entirely, no partial load.

## Required Rust Crates

Already locked in stack.md: `rmp-serde`, `zstd`, `thiserror`, `image`, `png`. No new crates needed for v1 file format (zstd's built-in checksum removes the need for `blake3`/`xxhash-rust`).

## Export Formats (v1)

- **PNG**: integer-only nearest-neighbor upscale (1×/2×/4×/8×/16×), tEXt metadata chunk with "Software: RaBIT X.Y.Z"
- **Spritesheet**: grid/horizontal/vertical, padding, sidecar JSON with frame rects + durations + tags
- **Palette import**: GPL, JASC PAL, hex list, PSP PAL, ASE (best-effort with disclaimer), CSV/TSV
- **Palette export**: all of the above + PNG swatch strip

## Migration Pipeline

Stub infrastructure in Rust (`migrate_vN_to_vM(rmpv::Value) -> rmpv::Value` chain) built in v1 even though no migrations exist yet. Proptest round-trip tests with fixture files from prior versions when they arrive.

**How to apply:** When writing the Rust deserializer (Phase 7), every limit in the table above must be a hard check before allocation. Any task proposing to bypass a limit "for convenience" must first get explicit PRD update.

## Open Questions (for Phase 6)

- Per-cell bounding boxes (memory savings vs complexity) — decide after Phase 7 profiling
- Indexed color mode for v2 (NES/GB/PICO-8 palette-constrained workflows)
- Animation ease curves (tweened frame timing) — not planned for v1
- Layer folders / nested groups — not in v1 PRD scope
