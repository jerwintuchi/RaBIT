# Spritesheet Import — Design

## Approach
A new "Import Spritesheet…" file menu item opens a dialog. The dialog loads the selected PNG via a new Tauri IPC command (`import_image`) that returns raw RGBA bytes + dimensions. The dialog renders a grid preview on a 2D canvas. On confirm, the frontend slices the pixel data into cells and creates frames using existing `frameActions` / `layerActions`. "New project" clears state first; "Append" adds frames to the current project.

## Affected Components

| File | Change |
|---|---|
| `src-tauri/src/lib.rs` | Register `import_image` command |
| `src-tauri/src/export/` (or new `src-tauri/src/import.rs`) | `import_image(path)` — load file with `image` crate, return RGBA bytes + w/h |
| `src/bridge/importIpc.ts` | `ipcImportImage(path): Promise<{width, height, data: number[]}>` |
| `src/ui/dialogs/SpritesheetImportDialog.tsx` | New dialog component |
| `src/ui/menu/FileMenu.tsx` | Add "Import Spritesheet…" menu item |
| `src/state/action-composers/file-actions.ts` | `importSpritesheet(cells, cellW, cellH, mode)` action |

## Data Model Changes
No changes to `Project`, `Layer`, or `Frame` types. Import builds on existing `addFrame` / `setCell` / `initNewProject` primitives.

## Key Flows

### Rust IPC: `import_image`
```rust
#[tauri::command]
async fn import_image(path: String) -> Result<ImportedImage, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?
        .into_rgba8();
    Ok(ImportedImage {
        width: img.width(),
        height: img.height(),
        data: img.into_raw(), // Vec<u8>, RGBA interleaved
    })
}
```

### Dialog flow
1. User clicks "Import Spritesheet…" → `dialog.open({ filters: [PNG, BMP, WebP] })`.
2. Selected path → `ipcImportImage(path)` → `{ width, height, data }`.
3. Dialog renders the image in a preview `<canvas>` (draw image, then overlay the grid lines).
4. User adjusts `cellWidth` / `cellHeight` → preview re-draws grid → computed `cols` and `rows` update in real-time.
5. User picks import mode (New Project / Append to current).
6. Confirm → `importSpritesheet(cells, cellW, cellH, mode)`.

### Grid preview rendering
```ts
function drawGrid(ctx: CanvasRenderingContext2D, imgW, imgH, cellW, cellH, scale) {
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 1 / scale;
  for (let x = 0; x <= imgW; x += cellW) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, imgH); ctx.stroke(); }
  for (let y = 0; y <= imgH; y += cellH) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(imgW, y); ctx.stroke(); }
}
```

### Cell slicing and frame creation
```ts
async function importSpritesheet(imageData, imgW, imgH, cellW, cellH, mode) {
  const cols = Math.floor(imgW / cellW);
  const rows = Math.floor(imgH / cellH);
  const cells: Uint8ClampedArray[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = new Uint8ClampedArray(cellW * cellH * 4);
      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          const srcIdx = ((row * cellH + py) * imgW + (col * cellW + px)) * 4;
          const dstIdx = (py * cellW + px) * 4;
          cell[dstIdx]   = imageData[srcIdx]!;
          cell[dstIdx+1] = imageData[srcIdx+1]!;
          cell[dstIdx+2] = imageData[srcIdx+2]!;
          cell[dstIdx+3] = imageData[srcIdx+3]!;
        }
      }
      cells.push(cell);
    }
  }
  if (mode === 'new') {
    await fileActions.initNewProject({ width: cellW, height: cellH });
  }
  for (const cellData of cells) {
    frameActions.addFrameWithData(cellData); // new variant of addFrame
  }
}
```

`addFrameWithData` will be a new action-composer that creates a frame and immediately populates the active layer's cell with the provided pixel data. It uses the existing `frameActions.addFrame()` + `SetCellCommand` pattern.

### "Append" canvas size guard
If appending and `cellW !== canvas.width || cellH !== canvas.height`, show an error in the dialog before allowing confirm.

## Trade-offs
- **Rust loads the file, not JS**: consistent with the architecture principle "Rust writes files". The raw bytes are transferred over IPC as `Vec<u8>`. For large sheets (e.g. 2048×2048) this is ~16MB — acceptable for a one-shot import.
- **Slice in JS, not Rust**: simpler; slicing RGBA arrays in JS is fast enough for any practical spritesheet.
- **Row-major slicing only**: left-to-right, top-to-bottom order. Standard for all tools that export spritesheets.

## Risks
- Large number of frames (e.g. 100+ cells): each `addFrameWithData` dispatches a command. Batch via a single `ImportSpritesheetCommand` that creates all frames atomically (one undo step). Flag this for the tasks phase.
