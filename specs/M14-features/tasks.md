# M14 — Task List

All tasks follow the spec-driven workflow. Each task is < 1 hour. Run `pnpm build` and `pnpm test` after every task group.

---

## Track A — GIF Export

### A1 — Cargo deps + gif.rs scaffold
- Add `imagequant = "4"`, `gif = "0.13"` to `src-tauri/Cargo.toml`
- Create `src-tauri/src/export/gif.rs` with stub `pub fn encode_gif(...) -> Result<(), String>`
- Add `mod gif;` to `src-tauri/src/export/mod.rs`
- **Verify:** `cargo check` passes

### A2 — GIF encode pipeline (Rust)
- Implement `encode_gif(frames: Vec<RgbaFrame>, options: GifOptions) -> Result<Vec<u8>, String>` in `gif.rs`
  - Per frame: `imagequant` quantize RGBA → indexed palette ≤ 256 colors, optional ordered dithering
  - `gif` crate: write GIF 89a header, per-frame palette + pixels + delay (frame.duration / 10)
  - Loop extension: set loop count (0 = infinite)
- **Verify:** unit test — encode a 2-frame 2×2 GIF, assert output starts with `GIF89a`

### A3 — export_gif Tauri command
- Add `export_gif` command in `src-tauri/src/export/commands.rs`
  - Accept `GifExportPayload { project: ProjectDto, options: GifOptions, output_path: String }`
  - Call `composite_frame` + `upscale` per frame → `encode_gif` → atomic write (tmp → rename)
  - Emit `export:progress` events (same pattern as spritesheet)
- Register in `src-tauri/src/lib.rs`
- Add `GifOptions` struct: `scale: u32, loop_count: u16, dither: bool`
- **Verify:** `cargo clippy` clean

### A4 — GIF IPC bridge + ExportDialog tab
- Add `ipcExportGif(options, projectDto)` to `src/bridge/exportIpc.ts`
- Add `exportGif()` action to `src/state/action-composers/exportActions.ts`
- Add GIF tab to `src/ui/dialogs/ExportDialog.tsx`:
  - Scale radio (1× / 2× / 4×)
  - Loop count input (0 = infinite)
  - Dither checkbox
  - Export button → `exportActions.exportGif()`
- **Verify:** `pnpm typecheck` clean; GIF tab renders in ExportDialog

---

## Track B — Canvas Rendering

### B1 — Tile mode state
- Add `tileMode: boolean` + `setTileMode(on: boolean)` to `src/state/useUIStore.ts`
- Add `T` keyboard shortcut in `src/App.tsx` → `setTileMode(!tileMode)`
- **Verify:** `pnpm typecheck` clean

### B2 — Tile mode shader + render engine
- Create `src/render/shaders/tile.frag.ts` — samples composite texture with `fract(uv)` UV wrapping to produce 3×3 tiling
- Add `setTileMode(on: boolean)` to `RenderingEngine` — switches blit pass between normal and tile shader
- Wire in `src/state/renderBridge.ts`: when `useUIStore.tileMode` changes, call `getEngine()?.setTileMode(on)`
- **Verify:** tile mode renders 3×3 grid in dev app; toggling T switches modes

### B3 — Mirror mode state + toolbar buttons
- Add `mirrorMode: { h: boolean; v: boolean }` + `setMirrorMode()` to `src/state/useToolStore.ts`
- Add `getMirrorMode()` to `ToolEngineContext` in `src/core/ToolEngine/types.ts`
- Supply it in `src/state/toolBridge.ts`
- Add H-mirror and V-mirror toggle buttons to `src/ui/toolbar/ToolBar.tsx`
- Add `Y` keybind in `src/App.tsx` → toggle `mirrorMode.h`; `Shift+Y` → toggle `mirrorMode.v`
- Add `mirror.horizontal` and `mirror.vertical` to `DEFAULT_KEYBINDINGS` in `usePrefsStore.ts`
- **Verify:** `pnpm typecheck` clean; buttons appear in toolbar

### B4 — Mirror stroke logic + axis guide overlay
- In `BrushTool.ts` and `EraserTool.ts`: after writing pixel at `(x, y)`, check `ctx.getMirrorMode()` and also write mirrored coordinates on scratch buffer
- In `RenderingEngine`: draw axis guide lines (cyan, 40% opacity) when `mirrorMode.h` or `.v` is active — rendered in overlay pass after composite
- **Verify:** painting with H mirror active produces symmetrical strokes on both sides

---

## Track C — Tools & UI

### C1 — TransformCommand + flip actions
- Create `src/core/commands/TransformCommand.ts`:
  - Stores `layerId`, `frameIndex`, `beforeData`, `afterData` (Uint8ClampedArray), optional `beforeCanvas`/`afterCanvas` dims
  - `execute`: uploads `afterData` via `notifyLayerChanged`; swaps canvas dims if present
  - `undo`: uploads `beforeData`; restores canvas dims if present
- Add `flipLayer(axis: 'h' | 'v')` to `src/state/action-composers/canvasActions.ts`:
  - Read active layer pixel buffer
  - Flip in JS (for H: reverse each row; for V: reverse row order)
  - Execute `TransformCommand`
- **Verify:** flip produces correct pixel output; undo restores original

### C2 — Rotate 90° + confirm dialog
- Create `src/ui/dialogs/RotateConfirmDialog.tsx` — shown when canvas is non-square before rotate
- Add `rotateConfirmDialog` state to `src/state/useUIStore.ts`
- Add `rotateLayer(dir: 'cw' | 'ccw')` to `canvasActions.ts`:
  - If `width !== height`: show `RotateConfirmDialog`, await user confirm
  - Rotate pixel data (CW: transpose + reverse rows; CCW: transpose + reverse cols)
  - If dims changed: resize all layer buffers across all frames, update canvas config
  - Execute `TransformCommand` with before/after canvas dims
  - Call `texCache.flush()` + `setCanvasSize()` if dims changed
- **Verify:** rotate 32×32 CW produces correct result; rotate 64×32 shows confirm dialog

### C3 — Edit menu transform items
- Add to `src/ui/menu/EditMenu.tsx`:
  - Separator
  - Flip Horizontal (`canvasActions.flipLayer('h')`)
  - Flip Vertical (`canvasActions.flipLayer('v')`)
  - Rotate 90° CW (`canvasActions.rotateLayer('cw')`)
  - Rotate 90° CCW (`canvasActions.rotateLayer('ccw')`)
- **Verify:** menu items appear; each triggers the correct action

### C4 — Magic Wand tool
- Create `src/core/tools/MagicWandTool.ts`:
  - `onPointerDown`: BFS flood-fill on composited pixels from click point
  - Tolerance from `ctx.getFillTolerance()` (existing context method)
  - Build `SelectionMask` with per-pixel data array
  - Call `ctx.setSelection(mask)`
  - If canvas > 512×512: offload BFS to Rust via new `compute_selection` IPC command (see C4b)
- Export from `src/core/tools/index.ts`
- Register in `src/state/toolBridge.ts`
- Add Magic Wand button to toolbar
- **Verify:** clicking a region selects contiguous pixels; selection mask renders as overlay

### C4b — Rust BFS for large canvases (Magic Wand)
- Add `compute_selection` Tauri command in `src-tauri/src/export/` (or new `src-tauri/src/tools.rs`):
  - Accept `pixels: Vec<u8>`, `width`, `height`, `start_x`, `start_y`, `tolerance: u8`
  - BFS → return `Vec<u8>` mask (1 byte per pixel)
- Add `ipcComputeSelection()` to bridge
- Wire in `MagicWandTool` for large canvases
- **Verify:** `cargo test` passes for BFS unit test

### C5 — Selection operations (Cut / Copy / Paste / Delete)
- Create `src/core/commands/SelectionCommands.ts`:
  - `CutCommand`: saves cut region before/after; execute clears pixels; undo restores
  - `PasteCommand`: merges clipboard pixels into layer at target position
  - `DeleteSelectionCommand`: fills selection with transparent
- Add `selectionClipboard` to `src/state/useToolStore.ts`
- Create `src/state/action-composers/selectionActions.ts`:
  - `cutSelection()`, `copySelection()`, `pasteSelection()`, `deleteSelection()`, `selectAll()`, `deselect()`
  - `copySelection`: also encodes PNG → `ipcWriteImageToClipboard` (fire-and-forget)
- Create `src/bridge/clipboardIpc.ts` with `ipcWriteImageToClipboard(pngBytes: Uint8Array)`
- Add `write_image_to_clipboard` Rust command + `tauri-plugin-clipboard-manager = "2"` dep
- Add capability `clipboard-manager:allow-write-image` to `default.json`
- Add Edit menu items: Cut (Ctrl+X), Copy (Ctrl+C), Paste (Ctrl+V), Delete, Select All (Ctrl+A), Deselect (Ctrl+D)
- Wire Ctrl+X/C/V/A/D shortcuts in `src/App.tsx`
- **Verify:** copy → deselect → paste places clipboard content; cut clears selection; undo works

### C6 — Marching ants selection overlay
- In `RenderingEngine`: render selection mask outline as animated dashed line in overlay pass
  - Add `u_time` uniform to overlay shader, increment each frame
  - Draw dashed outline by sampling `selectionMask` boundary pixels
- Wire selection mask upload in `renderBridge.ts`: when `useToolStore.selection` changes, upload to GPU
- **Verify:** selection renders animated dashed border around selected region

### C7 — Reference image Rust command + store
- Create `src-tauri/src/reference.rs` with `load_reference_image` command:
  - Accept `path: String`
  - Decode with `image` crate (already dep) → RGBA bytes
  - Return `{ pixels: Vec<u8>, width: u32, height: u32 }`
- Register command in `lib.rs`
- Create `src/bridge/referenceIpc.ts` with `ipcLoadReferenceImage(path)`
- Create `src/state/useReferenceStore.ts`:
  - `path`, `imageData: Uint8ClampedArray | null`, `width`, `height`
  - `opacity: number` (0–1), `position: { x: number; y: number }`
  - `setImage()`, `setOpacity()`, `setPosition()`, `clear()`
- Add `referencePath: string | null` to `Project` type and `useProjectStore`
- Serialize/deserialize `referencePath` in `projectSerializer.ts`
- On project load: if `referencePath` is set, auto-call `ipcLoadReferenceImage`
- **Verify:** `cargo check` clean; store hydrates on project load

### C8 — Reference image GPU render + viewport drag
- In `RenderingEngine`: upload reference image to a dedicated GPU texture slot; render below/above layer composite with opacity
- In `renderBridge.ts`: when `useReferenceStore` changes, upload texture + set opacity uniform
- In `CanvasViewport.tsx`: on Alt+drag → move reference image position (stored in `useReferenceStore`)
- Create `src/ui/panels/ReferencePanel/`:
  - Opacity slider (0–100%)
  - "Remove" button → `useReferenceStore.clear()` + `useProjectStore.setReferencePath(null)`
  - "Add Reference" button → file picker → `ipcLoadReferenceImage`
- Add File → Add Reference Image menu item
- **Verify:** reference image renders at configured opacity; drag moves it; Remove clears it

### C9 — Nine-slice preview panel
- Create `src/state/useNineSliceStore.ts`:
  - `visible: boolean`, `margins: { top, right, bottom, left }` (px), `targetW`, `targetH`
  - Actions: `setVisible()`, `setMargin()`, `setTargetSize()`
- Create `src/ui/panels/NineSlicePanel/NineSlicePanel.tsx`:
  - Four margin sliders (0 to canvas dimension / 2)
  - Target size W × H inputs
  - Canvas2D `<canvas>` element: reads current frame composite, draws nine-slice stretch
  - Updates on every margin/target/frame change
- Add View → Nine-Slice Preview toggle to `ViewMenu`
- **Verify:** adjusting margins updates preview; corner tiles are unscaled; edges stretch correctly

### C10 — ViewMenu + final wiring
- Create `src/ui/menu/ViewMenu.tsx`:
  - Tile Mode (T) — toggle
  - Nine-Slice Preview — toggle
  - (move Show Grid, Show Checkerboard here from CanvasMenu if it exists)
- Add `<ViewMenu />` to `src/ui/menu/MenuBar.tsx`
- Ensure all new keyboard shortcuts are registered in `DEFAULT_KEYBINDINGS` in `usePrefsStore.ts`
- **Verify:** ViewMenu renders; all items function

---

## Verification Pass

### V1 — Build + tests
- `pnpm build` — zero errors
- `pnpm test` — 11/11 pass
- `cargo clippy --all-targets -- -D warnings` — zero errors
- `cargo test` — all pass
- `pnpm lint` — zero errors
- `pnpm typecheck` — zero errors

### V2 — Manual smoke test (in dev app)
- [ ] GIF export: create 3-frame animation → File → Export → GIF → verify file plays in browser
- [ ] Tile mode: open a project → T → verify 3×3 grid → paint → tiles update live
- [ ] Flip H: draw asymmetric sprite → Edit → Flip Horizontal → verify → Ctrl+Z
- [ ] Rotate 90°: 32×32 canvas → Rotate CW → correct → Ctrl+Z; 64×32 → confirm dialog appears
- [ ] Mirror H: enable mirror → draw left side → right side appears symmetrically
- [ ] Reference image: Add Reference Image → drag → opacity slider → Remove
- [ ] Magic Wand: click solid region → selection appears → Copy → Paste
- [ ] Cut/Paste: select region → Cut → Paste → move floating selection → commit
- [ ] Nine-slice: open panel → set margins → resize target → corners unscaled

### V3 — Update phase tracker + commit

---

## Task Dependencies

```
A1 → A2 → A3 → A4
B1 → B2
B3 → B4
C1 → C2 → C3
C4 → C4b → C5 → C6
C7 → C8
C9 → C10
```

Tracks A, B (B1-B2), B (B3-B4), C1-C3, C4-C6, C7-C8, C9-C10 can all start in parallel after design approval.
```
