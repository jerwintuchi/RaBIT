# M14 — Feature Expansion Design

## Approach
Seven features grouped into three implementation tracks that can be partially parallelised:

- **Track A — Rust backend:** GIF export (new Rust module + `imagequant`)
- **Track B — Canvas rendering / GPU:** Tile mode, Mirror mode (shader + viewport overlays)
- **Track C — Tools & UI:** Transform tools, Selection tools (Magic Wand), Reference image layer, Nine-slice preview

Implementation order within each track is sequential; tracks B and C can start simultaneously after Track A's IPC is scaffolded.

---

## Feature 1 — GIF Export

### Affected Components
| Layer | File | Change |
|---|---|---|
| Rust | `src-tauri/Cargo.toml` | Add `imagequant = "4"`, `gif = "0.13"` |
| Rust | `src-tauri/src/export/gif.rs` | New — GIF encode pipeline |
| Rust | `src-tauri/src/export/commands.rs` | New command `export_gif` |
| Rust | `src-tauri/src/lib.rs` | Register command |
| TS bridge | `src/bridge/exportIpc.ts` | Add `ipcExportGif()` |
| TS UI | `src/ui/dialogs/ExportDialog.tsx` | Add GIF tab |
| TS state | `src/state/action-composers/exportActions.ts` | Add `exportGif()` |

### Data Model Changes
New IPC payload type:
```ts
interface GifExportOptions {
  path: string;
  scale: 1 | 2 | 4;
  loop_count: number;       // 0 = infinite
  dither: boolean;
}
```

### Key Flow
```
User → ExportDialog GIF tab → exportActions.exportGif()
  → ipcExportGif(options, projectDto)
  → Rust export_gif command:
      for each frame:
        composite_frame() → RGBA pixels
        upscale() if scale > 1
        imagequant: quantize to palette ≤ 256 colors
        gif crate: encode frame with delay = frame.duration / 10 (gif units = 10ms)
      emit progress events
      atomic write (tmp → rename)
  → toast "GIF exported"
```

### Trade-offs
- `imagequant` (libimagequant binding) produces significantly better quality than `color_quant` median-cut at the cost of ~10–50ms extra per frame. Acceptable for export path.
- Per-frame quantization (vs global palette): better quality per frame, larger file. Chosen for quality.
- `gif` crate writes LZW-compressed GIF 89a. Widely compatible.

---

## Feature 2 — Tile / Seamless Mode

### Affected Components
| Layer | File | Change |
|---|---|---|
| TS state | `src/state/useUIStore.ts` | Add `tileMode: boolean`, `setTileMode()` |
| TS render | `src/render/RenderingEngine.ts` | Add `setTileMode(on)`, render 3×3 grid |
| TS render | `src/render/shaders/tile.frag.ts` | New shader (or extend blit.frag) — sample with `mod(uv, 1.0)` |
| TS bridge | `src/state/renderBridge.ts` | Pass tile mode flag to engine |
| TS UI | `src/ui/canvas/CanvasViewport.tsx` | Toggle handler, `T` shortcut |
| TS UI | `src/ui/menu/ViewMenu.tsx` | New menu with Tile Mode item |

### Key Flow
- Tile mode is a **viewport-only** change. The composite texture is rendered normally; the blit pass samples with `fract(uv * 3.0 - 1.0)` to repeat across a 3× viewport region.
- The center tile aligns with the normal canvas position. The 8 surrounding copies use UV offsets.
- The render engine already has a full-screen blit pass — tile mode switches its UV sampling mode.
- No data duplication; no changes to layer stores or project data.

### Shader Strategy
Extend the existing `blit.frag.ts`:
```glsl
uniform bool u_tileMode;
// if tileMode: map screen UV → canvas UV via fract, expand viewport bounds
```
Alternatively: a dedicated tile blit shader toggled at draw time. The dedicated shader is cleaner — chosen to avoid branching in the common non-tile path.

---

## Feature 3 — Transform Tools (Flip H/V, Rotate 90°)

### Affected Components
| Layer | File | Change |
|---|---|---|
| TS core | `src/core/commands/TransformCommand.ts` | New — stores before/after RGBA delta |
| TS state | `src/state/action-composers/canvasActions.ts` | Add `flipLayer()`, `rotateLayer()` |
| TS state | `src/state/useUIStore.ts` | Add `rotateConfirmDialog` |
| TS UI | `src/ui/dialogs/RotateConfirmDialog.tsx` | New — "Canvas will resize. Continue?" |
| TS UI | `src/ui/menu/EditMenu.tsx` | Add Flip H, Flip V, Rotate CW, Rotate CCW items |

### Data Model Changes
`TransformCommand` stores:
- `layerId`, `frameIndex`
- `beforeData: Uint8ClampedArray`, `afterData: Uint8ClampedArray` (delta — same as LayerCommands pattern)
- `beforeCanvas: { w, h }`, `afterCanvas: { w, h }` (for rotate on non-square canvases)

### Key Flow — Flip
```
Edit → Flip Horizontal
  → canvasActions.flipLayer('horizontal')
  → read active layer pixel buffer
  → for each row: reverse pixel order in-place → afterData
  → execute TransformCommand(beforeData, afterData)
  → notifyLayerChanged → GPU upload
```

### Key Flow — Rotate 90°
```
Edit → Rotate 90° CW
  → if canvas.width !== canvas.height: show RotateConfirmDialog
  → on confirm: rotate pixel data (transposed + reversed rows for CW)
  → if dims changed: update canvas config (swap w/h), resize all layer buffers for all frames
  → execute TransformCommand (with canvas resize metadata)
  → GPU: texCache.flush() + new canvas size
```

### Trade-offs
- Rotate on non-square canvas requires resizing **all** layers across **all** frames. This is O(frames × layers) but done in one Command so it's one undo step. Memory cost is 2× the full project pixel data during the operation.
- Flip is always in-place (same dimensions) — no resize needed.

---

## Feature 4 — Mirror Mode

### Affected Components
| Layer | File | Change |
|---|---|---|
| TS state | `src/state/useToolStore.ts` | Add `mirrorMode: { h: boolean; v: boolean }`, `setMirrorMode()` |
| TS core | `src/core/tools/BrushTool.ts` | Mirror strokes on scratch buffer |
| TS core | `src/core/tools/EraserTool.ts` | Mirror erase strokes |
| TS core | `src/core/ToolEngine/types.ts` | Add `getMirrorMode()` to context |
| TS state | `src/state/toolBridge.ts` | Supply `getMirrorMode()` from store |
| TS render | `src/render/RenderingEngine.ts` | Draw axis guide overlay |
| TS UI | `src/ui/toolbar/ToolBar.tsx` | Mirror toggle buttons (H / V) |
| TS UI | `src/App.tsx` | `Y` keybind to toggle H mirror |

### Key Flow
```
User presses Y → toggles mirrorMode.h
During BrushTool.onPointerMove:
  → paint pixel at (x, y) on scratch buffer (existing)
  → if mirrorMode.h: also paint at (canvasW - 1 - x, y)
  → if mirrorMode.v: also paint at (x, canvasH - 1 - y)
  → if both: also paint at (canvasW - 1 - x, canvasH - 1 - y)
On pointerUp → CommitStrokeCommand writes all 4 quadrants as one delta
```

### Axis Guide Overlay
- RenderingEngine draws a 1px line at x = canvasW/2 (H mirror) and/or y = canvasH/2 (V mirror) during the overlay pass, using a fixed color (e.g. cyan at 40% opacity).
- Guide is rendered after composite, before the UI overlay pass — never baked into pixel data.

---

## Feature 5 — Reference Image Layer

### Affected Components
| Layer | File | Change |
|---|---|---|
| TS state | `src/state/useReferenceStore.ts` | New — path, opacity, position, imageData |
| TS bridge | `src/bridge/referenceIpc.ts` | New — `ipcLoadReferenceImage(path)` → RGBA bytes |
| Rust | `src-tauri/src/reference.rs` | New command `load_reference_image` — reads file, decodes to RGBA |
| Rust | `src-tauri/src/lib.rs` | Register command |
| TS render | `src/render/RenderingEngine.ts` | Upload reference texture, render with opacity |
| TS state | `src/state/renderBridge.ts` | Upload reference image to GPU |
| TS UI | `src/ui/canvas/CanvasViewport.tsx` | Drag handler for reference position |
| TS UI | `src/ui/panels/ReferencePanel/` | New — opacity slider, "Remove" button |
| TS state | `src/state/useProjectStore.ts` | Add `referencePath: string \| null` (persisted) |
| TS bridge | `src/bridge/projectSerializer.ts` | Serialize/deserialize `referencePath` |

### Data Model Changes
- `Project` type gains `referencePath: string | null` — saved to `.rabit` file.
- `useReferenceStore` holds runtime state (decoded `ImageData`, position, opacity) — not saved.
- On project load: if `referencePath` is set, auto-trigger `ipcLoadReferenceImage`.

### Key Flow
```
File → Add Reference Image
  → file picker (PNG/JPG/WEBP)
  → ipcLoadReferenceImage(path) → Rust decodes with `image` crate → Vec<u8> RGBA
  → useReferenceStore.setImage(path, rgbaBytes, width, height)
  → renderBridge uploads texture to GPU reference slot
  → RenderingEngine renders reference at configured opacity below/above layers
  → useProjectStore.setReferencePath(path) → marks project dirty
```

### Trade-offs
- **Path-only persistence**: if the reference file moves, user sees "reference image missing" on load — graceful degradation, no crash.
- Decoding on the Rust side (via `image` crate, already a dep) avoids browser CORS/format limits and leverages existing PNG/JPEG decoders.
- Reference image uploaded as a separate GPU texture slot — rendered in its own draw call, no interference with layer compositing.

---

## Feature 6 — Selection Tools

### Affected Components
| Layer | File | Change |
|---|---|---|
| TS core | `src/core/tools/MagicWandTool.ts` | New — flood-fill selection |
| TS core | `src/core/tools/index.ts` | Export MagicWandTool |
| TS core | `src/core/commands/SelectionCommands.ts` | New — CutCommand, PasteCommand |
| TS state | `src/state/useToolStore.ts` | Add `selectionClipboard: Uint8ClampedArray \| null`, `clipboardBounds` |
| TS state | `src/state/action-composers/selectionActions.ts` | New — cut, copy, paste, delete, selectAll, deselect |
| TS state | `src/state/toolBridge.ts` | Register MagicWandTool |
| TS bridge | `src/bridge/clipboardIpc.ts` | New — `ipcWriteImageToClipboard(png)` |
| Rust | `src-tauri/src/clipboard.rs` | New command `write_image_to_clipboard` |
| Rust | `src-tauri/Cargo.toml` | Add `tauri-plugin-clipboard-manager = "2"` |
| TS UI | `src/ui/menu/EditMenu.tsx` | Add Cut/Copy/Paste/Delete/Select All/Deselect |
| TS UI | `src/ui/toolbar/ToolBar.tsx` | Add Magic Wand tool button |
| TS render | `src/render/RenderingEngine.ts` | Render selection overlay (marching ants) |

### Data Model Changes
`SelectionMask` already defined in `src/core/ToolEngine/types.ts` — used as-is.

In-memory clipboard:
```ts
// in useToolStore
selectionClipboard: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  originX: number; // canvas position where it was copied from
  originY: number;
} | null
```

### Magic Wand Algorithm
Flood-fill on the **composited** pixel data (not a single layer):
1. Read composite pixels via `readCompositePixel` (existing context method)
2. BFS from click point, include pixels within `tolerance` (color distance)
3. Build `SelectionMask` with per-pixel data array
4. Store in `useToolStore.selection`

### Selection Operations Flow
- **Copy**: read `selection.bounds` pixels from active layer → store in `selectionClipboard` → encode as PNG → `ipcWriteImageToClipboard` (system clipboard, fire-and-forget)
- **Cut**: same as Copy + fill selection area with transparent → `CutCommand`
- **Paste**: create floating selection from `selectionClipboard` at canvas center → MoveTool takes over → on commit: `PasteCommand` merges into active layer
- **Delete**: fill selection with transparent → `DeleteSelectionCommand`

### Marching Ants Overlay
- RenderingEngine renders the selection mask outline as a dashed line animated via `u_time` uniform.
- Uses the existing overlay draw pass — no new framebuffer needed.

---

## Feature 7 — Nine-Slice Preview

### Affected Components
| Layer | File | Change |
|---|---|---|
| TS state | `src/state/useNineSliceStore.ts` | New — margins, targetW, targetH, visible |
| TS UI | `src/ui/panels/NineSlicePanel/` | New — margin sliders, target size inputs, Canvas2D preview |
| TS UI | `src/ui/menu/ViewMenu.tsx` | Toggle Nine-Slice Preview |

### Key Flow
- Nine-slice preview uses a **Canvas2D** element (not WebGL) for the preview render — simpler implementation for a read-only stretched preview.
- On each margin/target change: read the current frame composite (via `getImageData` from the offscreen canvas or use the existing `readCompositePixel` in bulk), apply nine-slice stretch algorithm to a Canvas2D, display.
- Nine-slice stretch algorithm: slice source into 9 regions by margins → draw corners 1:1, stretch edges along one axis, stretch center on both axes.
- No IPC required — all client-side Canvas2D math.
- State is session-only (no persistence).

---

## Shared Infrastructure Changes

### ViewMenu (new)
`src/ui/menu/ViewMenu.tsx` — new menu between Edit and Canvas:
- Tile Mode (T)
- Nine-Slice Preview
- (existing grid/checkerboard toggles move here from CanvasMenu if appropriate)

### Capability additions (`src-tauri/capabilities/default.json`)
- `clipboard-manager:allow-write-image` — for system clipboard PNG write

### Cargo.toml additions
```toml
imagequant = "4"
gif = "0.13"
tauri-plugin-clipboard-manager = "2"
```

---

## Risks
| Risk | Mitigation |
|---|---|
| `imagequant` compile time adds to CI | Pre-warm cargo cache; acceptable one-time cost |
| Rotate-all-layers memory spike on large projects | Warn user; operation is synchronous and blocks UI briefly |
| Magic Wand on large canvases (4096×4096) slow BFS | Run BFS in a Web Worker or Rust via IPC if > 512×512; add timeout guard |
| Reference image decode fails (corrupt file) | Rust returns `Err`, TS shows toast, no crash |
| System clipboard PNG write permission denied | Fire-and-forget with silent failure — in-memory clipboard still works |
