# M11 — PNG + Spritesheet Export — Stage 2: Design

## Approach

Export runs entirely in Rust. The frontend serializes the full project (same `ProjectDto` as save), passes it with export options to a Tauri command, and Rust composites layers → encodes PNG → writes to disk in a background async task. Progress events are emitted back to the frontend after each frame.

**Why CPU compositing in Rust (not JS + WebGL readback):**
- Canvas is ≤ 640×640 — CPU compositing is fast enough at MVP scale
- Rust owns the entire export pipeline end-to-end (no mid-export JS round-trips)
- `readPixels` from WebGL requires the UI thread and blocks rendering

---

## Affected Components

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `png = "0.17"` |
| `src-tauri/src/export/mod.rs` | **New** — module root, re-exports |
| `src-tauri/src/export/dto.rs` | **New** — `PngExportOptions`, `SpritesheetExportOptions`, `ExportResult`, `ExportProgress` |
| `src-tauri/src/export/composite.rs` | **New** — linked-cell resolution, layer compositing (all 6 blend modes), nearest-neighbour upscale, background fill |
| `src-tauri/src/export/encode.rs` | **New** — PNG encoding with `tEXt` Software chunk via `png` crate |
| `src-tauri/src/export/spritesheet.rs` | **New** — horizontal/vertical/grid layout into one RGBA buffer + sidecar JSON |
| `src-tauri/src/export/commands.rs` | **New** — `export_png`, `export_spritesheet` Tauri commands |
| `src-tauri/src/lib.rs` | Register `export` mod + 2 new commands |
| `src/bridge/exportIpc.ts` | **New** — IPC wrappers + `listenExportProgress` |
| `src/state/useUIStore.ts` | Add `exportDialog: { open: boolean }` state + show/hide actions |
| `src/state/action-composers/exportActions.ts` | **New** — `exportPng`, `exportSpritesheet` |
| `src/state/action-composers/index.ts` | Add `export * as exportActions` |
| `src/ui/dialogs/ExportDialog.tsx` + `.module.css` | **New** — two-tab export dialog |
| `src/ui/dialogs/index.ts` | Export `ExportDialog` |
| `src/ui/menu/FileMenu.tsx` | Add "Export…" item (Ctrl+E) |
| `src/App.tsx` | Mount `<ExportDialog />`; wire Ctrl+E shortcut |

---

## New Rust DTOs (`export/dto.rs`)

```rust
pub enum FrameSelection { Current { index: u32 }, All }

pub struct PngExportOptions {
    pub project: ProjectDto,
    pub frame_selection: FrameSelection,
    pub scale: u32,               // 1 | 2 | 4 | 8 | 16
    pub include_background: bool,
    pub output_dir: String,
    pub name_prefix: String,      // sanitised project name
}

pub enum SheetLayout { Horizontal, Vertical, Grid { columns: u32 } }

pub struct SpritesheetExportOptions {
    pub project: ProjectDto,
    pub layout: SheetLayout,
    pub padding: u32,             // 0–16 px between frames
    pub scale: u32,
    pub include_background: bool,
    pub output_path: String,
    pub sidecar_json: bool,
}

pub struct ExportResult { pub paths: Vec<String> }

// Emitted as "export:progress" Tauri events
pub struct ExportProgress { pub done: u32, pub total: u32 }
```

---

## Key Flows

### PNG Frames export
```
ExportDialog → exportActions.exportPng(options)
  → snapshotProject() → invoke('export_png', options)
  → Rust (async task):
      for each selected frame:
        composite_frame(project, frame_idx, bg_color?) → Vec<u8> (RGBA)
        upscale(pixels, w, h, scale) → Vec<u8>
        encode_png(pixels, scaled_w, scaled_h) → write to {outputDir}/{prefix}_{frame:03d}.png
        emit export:progress { done, total }
  → return ExportResult { paths }
  → toast.info("Exported N frame(s) to …/dir")
```

### Spritesheet export
```
invoke('export_spritesheet', options)
  → Rust (async task):
      for each frame: composite → upscale → collect Vec<Vec<u8>>
        emit export:progress per frame
      layout: compute sheet_w, sheet_h, frame offsets
      blit each frame buffer into sheet at (x, y)
      encode_png(sheet, sheet_w, sheet_h) → write to output_path
      if sidecar_json: assemble JSON, write to output_path.replace(".png", ".json")
  → return ExportResult { paths: [png_path, json_path?] }
```

---

## Compositing Algorithm (`composite.rs`)

### Linked-cell resolution
Walk backward from `frame_idx` until a non-linked cell with data is found. If no cell exists for a layer in any frame, treat as fully transparent.

### Layer compositing (bottom → top)
```
start with bg: if include_background → fill with canvas.backgroundColor, else transparent
for layer in layers (index 0 = bottom):
  if !layer.visible: skip
  pixels = resolve_cell(frames, frame_idx, layer.id)
  for each pixel (dx, dy):
    src = apply_opacity(pixels[dx,dy], layer.opacity)
    dst[dx,dy] = blend(dst[dx,dy], src, layer.blend_mode)
```

### Blend modes (straight alpha)
```
Normal:   out.a = src.a + dst.a*(1-src.a)
          out.rgb = (src.rgb*src.a + dst.rgb*dst.a*(1-src.a)) / out.a
Multiply: src' = src.rgb * dst.rgb / 255  → Normal blend with src'
Screen:   src' = 255 - (255-src.rgb)*(255-dst.rgb)/255  → Normal blend
Overlay:  src' = per-channel overlay formula → Normal blend
Add:      src' = min(src.rgb + dst.rgb, 255)  → Normal blend
Subtract: src' = max(dst.rgb - src.rgb, 0)   → Normal blend
```

### Nearest-neighbour upscale
Each source pixel at `(x, y)` fills an `scale×scale` block at `(x*scale, y*scale)` in output.

---

## Spritesheet Layout (`spritesheet.rs`)

```
Horizontal:
  sheet_w = frame_w*N + padding*(N-1)
  sheet_h = frame_h
  frame i → x = i*(frame_w + padding), y = 0

Vertical:
  sheet_w = frame_w
  sheet_h = frame_h*N + padding*(N-1)
  frame i → x = 0, y = i*(frame_h + padding)

Grid(cols):
  cols = min(cols, N)
  rows = ceil(N / cols)
  sheet_w = frame_w*cols + padding*(cols-1)
  sheet_h = frame_h*rows + padding*(rows-1)
  frame i → col = i%cols, row = i/cols
           x = col*(frame_w+padding), y = row*(frame_h+padding)
```

### Sidecar JSON schema (data-model §6.3)
```json
{
  "image": "hero.png",
  "width": 256, "height": 64,
  "frameCount": 4,
  "frameWidth": 64, "frameHeight": 64,
  "frames": [
    { "index": 0, "x": 0, "y": 0, "w": 64, "h": 64, "duration": 100 }
  ],
  "tags": [{ "name": "walk", "from": 0, "to": 3 }]
}
```

---

## Export Dialog UI (`ExportDialog.tsx`)

Two-tab card modal — **PNG Frames** / **Spritesheet**:

**PNG Frames tab:**
- Frame: `Current frame` / `All frames` radio
- Scale: 1× / 2× / 4× / 8× / 16× button group
- Include background checkbox
- Output directory picker button + path display

**Spritesheet tab:**
- Layout: Horizontal / Vertical / Grid radio; Grid shows column count input
- Padding: 0–16 number input
- Scale: same button group
- Include background checkbox
- Sidecar JSON checkbox
- Output file picker + path display

**Footer:** progress bar (hidden until export starts, fills as frames complete), Export button, Cancel.

---

## Trade-offs

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Compositing | Rust CPU | JS + WebGL readback | No UI thread block; clean pipeline |
| PNG crate | `png` only | `image` crate | `image` adds JPEG/WebP decoders we don't need; `png` is minimal |
| Linked-cell resolution | Backward scan per frame | Pre-resolved store | Simple and correct; O(frames×layers) is negligible at MVP canvas size |
| Export payload | Full `ProjectDto` re-sent | Pixel-only payload | Reuses existing serialization; no new IPC shape needed |
| Blend modes | All 6 in Rust | Normal only | All modes are simple arithmetic; cost is low; missing modes would break real projects |
| Scale options | 1/2/4/8/16 integer only | Fractional | Pixel art must be pixel-perfect; fractional scales cause blurring |
