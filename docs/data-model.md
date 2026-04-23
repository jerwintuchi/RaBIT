# RaBIT — Data Model & File Format
**Version:** 1.0
**Date:** 2026-04-19
**Status:** Approved for Milestones Phase

---

## 1. Scope

This document specifies:
- The **in-memory data model** — TypeScript types that represent a live RaBIT project
- The **`.rabit` binary file format** — byte-level layout, versioning, integrity, migration
- **Auxiliary formats** — PNG export, spritesheet, palette import/export, preferences

Architecture.md §8 sketched the high-level shape; this document locks the exact field names, types, byte offsets, and rules. After Phase 5, changes to the file format require a version bump and a migration plan.

---

## 2. In-Memory Data Model

All types are pure data. No methods, no classes. They live in `src/core/DataModel/`.

### 2.1 Primitive Aliases

```typescript
type LayerId = string          // nanoid, 12 chars
type FrameId = string          // nanoid, 12 chars
type CommandId = string        // nanoid, 12 chars
type TagId = string            // nanoid, 12 chars
type PaletteId = string        // nanoid, 12 chars

type RGBA = number             // 32-bit packed: (R << 24) | (G << 16) | (B << 8) | A
                               // Big-endian in-memory for GPU upload consistency
```

### 2.2 Project (top-level)

```typescript
interface Project {
  /* Identity */
  schemaVersion: 1              // bump on any breaking schema change (body-level)
  projectId: string              // nanoid, stable across saves — used for auto-save correlation

  /* Metadata */
  name: string                   // display name, not filename
  author: string | null          // optional, defaults to OS username on creation
  createdAt: number              // unix ms
  modifiedAt: number             // unix ms
  application: string            // "RaBIT 0.1.0" — app version that last wrote this file

  /* Canvas configuration */
  canvas: CanvasConfig

  /* Content */
  layers: Layer[]                // ordered bottom-to-top (index 0 = background)
  frames: Frame[]                // ordered, index = frame number
  palette: Palette
  tags: Tag[]                    // animation tags (named frame ranges)

  /* View state (optional — persisted so opening feels continuous) */
  activeLayerId: LayerId | null
  activeFrameIndex: number
  zoomLevel: number
  panOffset: { x: number, y: number }
}
```

**Design note — activeLayerId / activeFrameIndex in the file:** these are view state, not project data. We persist them so reopening a file restores the user's working position. The tradeoff: a project file slightly reflects a single user's last session. That's acceptable for a single-user desktop tool.

### 2.3 CanvasConfig

```typescript
interface CanvasConfig {
  width: number                  // 1–4096, integer
  height: number                 // 1–4096, integer
  colorMode: 'rgba'              // v1 only supports 'rgba'. 'indexed' is v2.
  backgroundColor: RGBA          // transparent by default (0x00000000)
  dpi: number                    // metadata only, defaults to 72
}
```

**Canvas size cap (4096×4096)** is a hard limit, not just a performance target. Enforced on:
- New canvas dialog (can't enter higher)
- Resize canvas dialog (can't enter higher)
- File load (reject files exceeding this — security boundary)

### 2.4 Layer

```typescript
interface Layer {
  id: LayerId
  name: string                   // 1–64 chars, UTF-8
  visible: boolean
  locked: boolean
  opacity: number                // 0.0–1.0
  blendMode: BlendMode
}

type BlendMode =
  | 'normal'                     // default
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'add'                        // linear add
  | 'subtract'                   // linear subtract
```

**Blend modes shipped in v1:** 6 total. All have GPU shader implementations in `src/render/shaders/composite.frag`. Additional modes (soft-light, color-dodge, etc.) are post-MVP — they require more sophisticated shader work and aren't high-value for pixel art.

### 2.5 Frame

```typescript
interface Frame {
  id: FrameId                    // stable across reorders
  duration: number               // ms, 10–10000, default 100
  cells: Record<LayerId, Cell>   // sparse — only populated cells present
}
```

Cells are stored in a map keyed by `LayerId` so we can represent "this frame has no cell for layer X" by omission, rather than storing a null entry. This makes linked-cell resolution cheaper.

### 2.6 Cell (the pixel buffer)

```typescript
interface Cell {
  /* Linked cells reference the prior frame's cell for the same layer.
   * When linked = true, `data` is null. Rendering resolves by walking
   * frames backward until a non-linked cell is found. */
  linked: boolean

  /* Raw RGBA pixel data, length = canvas.width * canvas.height * 4.
   * null iff linked = true. */
  data: Uint8ClampedArray | null
}
```

**Why not support per-cell bounds (smaller bounding-box cells)?**
- Aseprite stores cells with per-cell `{x, y, width, height}` to save memory when a layer only uses a corner.
- RaBIT v1 stores full-canvas cells. Rationale: simpler math everywhere (rendering, export, transforms, flood fill), and memory savings are already covered by (a) linked cells for unchanged layers and (b) zstd compression at save time.
- Revisit for v2 once profiling reveals cases where this matters in practice.

### 2.7 Palette

```typescript
interface Palette {
  id: PaletteId
  name: string                   // "Untitled Palette", "NES", "PICO-8", etc.
  swatches: Swatch[]             // 1–256 for v1, technically up to 65535
}

interface Swatch {
  color: RGBA
  name: string | null            // optional, null for unnamed
}
```

### 2.8 Tag (animation range label)

```typescript
interface Tag {
  id: TagId
  name: string                   // "walk", "idle", etc.
  from: number                   // frame index, inclusive
  to: number                     // frame index, inclusive
  loopDirection: 'forward' | 'reverse' | 'ping-pong'
  color: RGBA                    // display color in timeline
}
```

### 2.9 History (NOT in file format)

The undo/redo stack is **deliberately excluded from the file**. Reasons:
- A saved project is the committed state, not a work session
- History for a long-running edit session can be hundreds of MB — bloats files
- Cross-session undo introduces correctness risks (a file edited elsewhere, then undone, would produce inconsistent state)

History lives only in memory (HistoryStore per architecture §9).

---

## 3. `.rabit` Binary File Format

### 3.1 Design Goals

1. **Compact** — zstd compression on the body
2. **Self-describing** — magic bytes + version in a fixed-offset header
3. **Safe to parse** — hard limits + no deserializer recursion over untrusted data
4. **Atomic-write friendly** — write `.rabit.tmp`, checksum verify, OS-atomic rename (architecture §12)
5. **Forward-compatible reads where possible** — newer writers can add fields; older readers preserve unknown fields on re-save

### 3.2 Byte Layout

```
Offset  Size   Type    Field
──────  ────   ─────   ─────────────────────────────────────
0       4      [u8;4]  Magic bytes: "RBIT" (0x52 0x42 0x49 0x54)
4       2      u16 LE  Format major version (current: 1)
6       2      u16 LE  Format minor version (current: 0)
8       4      u32 LE  Flags (reserved, must be 0 in v1.0)
12      4      u32 LE  Extended header length (0 in v1.0; reserved for future)
16      8      u64 LE  Uncompressed body size (sanity check before decompression)
24      8      u64 LE  Compressed body size (must match remaining file length)
32      ...            zstd-compressed MessagePack body
                       (zstd frame carries its own XXH64 content checksum — see §3.5)
```

**Fixed header size:** 32 bytes. Every `.rabit` file starts identically through byte 31.

### 3.3 Version Semantics

- **Major version** bump: breaking change (renamed fields, changed semantics, structural reorganization). Older readers MUST reject newer major versions.
- **Minor version** bump: additive, backward-compatible (new optional fields, new enum variants with safe defaults). Older readers SHOULD open newer minor-version files with best-effort behavior, preserving unknown fields on re-save.

**v1.0 behavior:** on load of a v1.x (x > 0) file, unknown body fields are preserved verbatim in a `_forward` map inside Project at load time, and re-emitted on save. This implements lossless round-tripping for files written by a newer RaBIT version.

### 3.4 Body: MessagePack Schema

The body is a MessagePack-serialized Project object (§2.2). Pixel data (`Cell.data`) is encoded as MessagePack **bin** type — a length-prefixed byte string.

MessagePack is preferred over JSON because:
- Binary-native (no base64 overhead for pixel buffers)
- Compact integer encoding
- Direct serde support via `rmp-serde`
- Streaming-decodable (for future partial-load scenarios)

**Numeric types in the body:**
- Frame/layer indices: u32
- Timestamps: i64 (unix ms, signed to allow pre-1970 in edge cases)
- Durations: u32 (ms)
- Opacity: f32
- Canvas dimensions: u32 (bounded by the 4096 cap)

### 3.5 Integrity Checking

**Single source of truth: zstd's built-in content checksum.**

When writing a `.rabit` file, the zstd stream is emitted with `--content-size` and `--content-checksum` flags (XXH64 of uncompressed body, stored in the zstd frame trailer). On read, zstd's decoder verifies the checksum automatically.

**Why not add a separate SHA/BLAKE hash in the header?**
- Redundant with zstd's checksum
- Slower (writing cost)
- We don't need cryptographic signing — we need corruption detection, which XXH64 provides

**Atomic write verification (architecture §12):**
1. Write full file to `.rabit.tmp`
2. Reopen `.rabit.tmp`, read header, call zstd's decode with checksum enabled
3. If checksum verifies → OS-atomic rename to `.rabit`
4. If checksum fails → delete `.tmp`, report error, original file untouched

### 3.6 Hard Limits (security boundaries)

Enforced in the Rust deserializer before any allocation:

| Limit | Value | Rationale |
|---|---|---|
| Max compressed file size | 2 GB | Sanity cap; reject abusive files |
| Max uncompressed body size | 8 GB | zstd bomb protection (4× the compressed cap) |
| Max canvas dimension | 4096 | Matches in-memory canvas cap |
| Max layers per project | 256 | Matches UI reasonable limit |
| Max frames per project | 10 000 | Matches UI reasonable limit |
| Max palette swatches | 65 535 | u16 space |
| Max cells (layers × frames) | 1 000 000 | Multiplicative cap; most files are far smaller |
| Max cell data size | `width × height × 4` | MUST equal this for non-linked cells |
| Max string field length | 1024 bytes UTF-8 | Name fields, author, tags |

**Rejection behavior:** any limit violation → deserialize fails with a structured error (file rejected entirely, no partial load). The user sees "File appears invalid or exceeds safe limits — may be corrupted or malicious."

### 3.7 Worked Example

A minimal 16×16 single-frame single-layer project:

```
Bytes  0– 3: "RBIT"
Bytes  4– 5: 0x0001 (major = 1)
Bytes  6– 7: 0x0000 (minor = 0)
Bytes  8–11: 0x00000000 (no flags)
Bytes 12–15: 0x00000000 (no extended header)
Bytes 16–23: body uncompressed size (e.g., 1234)
Bytes 24–31: body compressed size (e.g., 287)
Bytes 32–318: zstd frame containing MessagePack-encoded Project
```

Full round-trip (load → re-save with no edits) produces a byte-identical file if and only if:
- Compression settings are deterministic (we fix zstd level = 3, strategy = default)
- Field order is canonical (`rmp-serde` with struct ordering preserved)

Byte-identical round-trip is **not a requirement**, but is a nice property for content-addressed storage and git diffing.

---

## 4. Auto-save File Format

Auto-saves use the **same format** as `.rabit`, with a different extension and path:

```
Path: <user data dir>/rabit/autosave/<project-id>.rabit.autosave
Format: identical to .rabit
```

An adjacent `autosave-manifest.json` records mapping:

```json
{
  "entries": [
    {
      "projectId": "abc123xyz",
      "originalPath": "C:\\Users\\jerwin\\sprites\\hero.rabit",
      "autoSavedAt": 1713553480000,
      "appVersion": "0.1.0"
    }
  ]
}
```

Crash recovery (architecture §13) reads the manifest on startup. Stale entries (original file newer than autosave, or original file missing) are offered to the user as recoverable sessions.

---

## 5. PNG Export (single frame)

### 5.1 Format

Standard PNG (RGBA, 8-bit per channel). Uses Rust `png` crate directly (not `image` — smaller dependency surface for the common case).

### 5.2 Export Options

```typescript
interface PngExportOptions {
  frameIndex: number | 'current' | 'all'    // which frame(s)
  layerMode: 'composite' | 'per-layer'      // composite flattened, or one PNG per layer
  scale: 1 | 2 | 4 | 8 | 16                 // integer-only upscale (nearest-neighbor)
  includeBackground: boolean                 // bake canvas.backgroundColor
  outputDir: string                          // validated by fs_sandbox
  filenamePattern: string                    // e.g., "{name}_{frame:03d}.png"
}
```

**Integer-only upscale:** pixel art must stay pixel-perfect. No bilinear, no Lanczos, no fractional scales in v1. Each pixel becomes an N×N block.

**Filename tokens:**
- `{name}` — project name (sanitized for filesystem)
- `{frame}` — frame index (1-based in display, 0-based in format — user sees 1)
- `{frame:03d}` — zero-padded frame index
- `{layer}` — layer name (sanitized, only for per-layer mode)
- `{tag}` — animation tag name (if exporting a tagged range)

### 5.3 PNG tEXt Metadata

RaBIT writes a `tEXt` chunk to exported PNGs:

```
Keyword: "Software"
Text: "RaBIT 0.1.0"
```

Optional additional chunk for projects that need round-tripping:

```
Keyword: "RaBIT-Source"
Text: "<project-id>:<frame-index>"
```

This is never required on import and can be safely ignored by any PNG reader.

---

## 6. Spritesheet Export

### 6.1 Format

A single PNG containing all frames laid out in a grid.

### 6.2 Options

```typescript
interface SpritesheetExportOptions {
  layout: 'horizontal' | 'vertical' | 'grid'
  gridColumns?: number              // required if layout = 'grid'
  padding: number                   // pixels between frames
  scale: 1 | 2 | 4 | 8 | 16
  frameSelection: 'all' | 'tag' | 'range'
  tag?: TagId                       // if frameSelection = 'tag'
  rangeStart?: number               // if frameSelection = 'range'
  rangeEnd?: number
  outputPath: string                // validated by fs_sandbox
  sidecarJson: boolean              // write accompanying .json metadata
}
```

### 6.3 Sidecar JSON

If `sidecarJson` = true, emits `<spritesheet>.json` with frame rect data:

```json
{
  "image": "hero.png",
  "width": 256,
  "height": 64,
  "frameCount": 16,
  "frameWidth": 16,
  "frameHeight": 16,
  "frames": [
    { "index": 0, "x": 0,  "y": 0, "w": 16, "h": 16, "duration": 100 },
    { "index": 1, "x": 16, "y": 0, "w": 16, "h": 16, "duration": 100 },
    ...
  ],
  "tags": [
    { "name": "walk", "from": 0, "to": 7 }
  ]
}
```

JSON schema is simple enough that game engines (Godot, Unity, custom) can parse it without a RaBIT-specific importer. Format is documented separately for third-party tool authors.

---

## 7. Palette Import / Export

### 7.1 Native Format (in `.rabit`)

Palettes embedded in a project use the Palette type (§2.7). No separate file.

### 7.2 Standalone Palette File: `.rabit-palette`

A trimmed subset of the main `.rabit` format: same 32-byte header (magic = `RBPL`), body is a MessagePack-encoded Palette object. Same integrity/versioning rules.

### 7.3 Importable Formats

| Format | Extension | Support Level | Notes |
|---|---|---|---|
| GIMP Palette | `.gpl` | Full | Plain text, well-documented |
| JASC Palette | `.pal` | Full | Plain text |
| Hex list | `.hex`, `.txt` | Full | One hex code per line |
| PaintShop Pro | `.pal` (binary variant) | Full | Binary, documented |
| Adobe Swatch Exchange | `.ase` | **Best-effort** | Undocumented format, community-reverse-engineered |
| CSV / TSV | `.csv` | Full | R,G,B[,A][,name] per line |

**Best-effort disclaimer for ASE:** per CLAUDE.md legal constraints, we implement ASE import without reference to Adobe's source. A warning banner on import says: "ASE format is undocumented; some color modes or groupings may not load correctly."

### 7.4 Exportable Formats

All importable formats above can also be exported, plus:
- PNG swatch strip (1 pixel per swatch, 16 px tall)

---

## 8. Preferences Storage (NOT in project file)

User preferences live outside the project file in a platform-specific app-data directory:

```
Windows: %APPDATA%\RaBIT\preferences.toml
macOS:   ~/Library/Application Support/RaBIT/preferences.toml
Linux:   ~/.config/rabit/preferences.toml
```

**Format: TOML** (not JSON). Reason: preferences are human-editable; TOML is friendlier for manual edits and comments.

### 8.1 Schema Sketch

```toml
schema_version = 1

[ui]
scale = 1.0                    # 0.9, 1.0, or 1.25
theme = "dark"                 # only "dark" in v1
panels_visible = true

[editor]
autosave_interval_minutes = 5
max_undo_stack = 1000
default_frame_duration_ms = 100

[canvas]
checkerboard_enabled = true
grid_enabled = false
pixel_grid_threshold_zoom = 8  # pixel grid auto-shows above this zoom

[keybindings]
# overrides; missing keys inherit defaults from design-system.md §6.5
"tool.pencil" = "B"
"file.save" = "Ctrl+S"

[recent]
files = [
  "C:\\Users\\jerwin\\sprites\\hero.rabit",
  "C:\\Users\\jerwin\\sprites\\enemy.rabit"
]
max_entries = 10
```

A corrupted or missing preferences file causes RaBIT to fall back to defaults silently (log a warning, do not block startup).

---

## 9. Migration Strategy

### 9.1 When a Migration Is Needed

- Breaking schema change: field renamed, removed, or semantics changed → **major version bump**
- Additive change that older versions can't safely default: rarer, but **minor bump with explicit default policy**

### 9.2 Migration Flow

```
Load file:
  1. Read 32-byte header
  2. If major > current: reject with "File from newer RaBIT — please update the app"
  3. If major < current: route through MigrationPipeline
  4. If major == current, minor > current: load with best-effort, preserve unknown fields
```

### 9.3 MigrationPipeline

A versioned chain of transforms in Rust:

```
migrate_v0_to_v1(Value) -> Value
migrate_v1_to_v2(Value) -> Value
...
```

Each step takes a parsed MessagePack `rmpv::Value`, transforms it, and passes to the next step. Applied sequentially until target version reached. Each migration is covered by a proptest-based round-trip test with fixture files from prior versions.

**v1.0 has no migrations yet** (first release). The infrastructure stub is built so v1 → v2 can be added cleanly.

---

## 10. Relationship to Architecture Primitives

Cross-reference map:

| This doc | Architecture.md |
|---|---|
| §2.2 Project | §8 Animation Data Model |
| §3 Binary format | §12 Project File I/O |
| §4 Auto-save | §13 Auto-Save & Crash Recovery |
| §3.6 Hard limits | §10 IPC security rule (paired with input validation) |
| §3.7 Atomic write | §12 Atomic Write sequence |
| §9 Migration | (new — not covered in architecture) |

---

## 11. Open Questions for Phase 6

These are not blocking for Phase 5 but should be resolved by the Milestones phase:

1. **Per-cell bounding boxes (v2):** does the memory saving justify the implementation complexity? Decide after Phase 7 profiling.
2. **Indexed color mode (v2):** required for true retro authenticity (NES, Game Boy, PICO-8 palettes enforce palette constraints). Deferred.
3. **Animation ease curves:** currently frame duration is uniform per frame. Could support tweened/eased timing for a future "motion" mode. Not planned for v1.
4. **Nested groups / layer folders:** common feature in Adobe/Figma. Not in PRD scope for v1.

---

*End of Data Model & File Format v1.0*
