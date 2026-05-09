# Canvas Resize — Stage 2: Design

## Approach
Single undoable command (`ResizeCanvasCommand`) that captures full before/after state. The command mutates pixel data in-place and updates `useProjectStore`'s canvas dimensions. A new "Canvas" menu in the MenuBar exposes the dialog.

## Affected components

| File | Change |
|---|---|
| `src/core/commands/ResizeCanvasCommand.ts` | **NEW** — implements Command, handles crop/expand/scale |
| `src/state/action-composers/canvasActions.ts` | **NEW** — `resizeCanvas(opts)` action composer |
| `src/state/action-composers/index.ts` | re-export `canvasActions` |
| `src/ui/dialogs/ResizeCanvasDialog.tsx` | **NEW** — dialog with mode toggle + preset grid |
| `src/ui/dialogs/ResizeCanvasDialog.module.css` | **NEW** — styles |
| `src/ui/dialogs/index.ts` | export new dialog |
| `src/ui/menu/CanvasMenu.tsx` | **NEW** — "Canvas" dropdown with "Resize Canvas…" item |
| `src/ui/menu/MenuBar.tsx` | add `<CanvasMenu />` beside `<FileMenu />` |
| `src/ui/menu/index.ts` | export `CanvasMenu` |
| `src/state/useUIStore.ts` | add `resizeCanvasDialog: { open: boolean }` slice |

## Data model changes
No new persisted fields. `useProjectStore.canvas.width/height` are updated in-place by the command. The resize command stores pixel snapshots for undo as plain `Uint8ClampedArray` copies.

## Key flows

### Crop / Expand
```
execute():
  for each frame × layer:
    old = resolveCell(frames, fi, layerId)           // may be null
    if old is null → skip (nothing to crop/restore)
    newData = new Uint8ClampedArray(newW * newH * 4)
    copy min(oldW, newW) × min(oldH, newH) pixels row-by-row
    setCell(frame.id, layerId, { linked: false, data: newData })
  setCanvasConfig({ width: newW, height: newH })
  invalidate all layer textures

undo():
  for each frame × layer:
    restore saved cell (or remove if it was null before)
  setCanvasConfig({ width: oldW, height: oldH })
  invalidate all layer textures
```

### Scale (nearest-neighbour)
```
execute():
  same as crop/expand but instead of a direct copy:
    for each dst pixel (dx, dy):
      sx = floor(dx * oldW / newW)
      sy = floor(dy * oldH / newH)
      copy src pixel [sx, sy] → dst pixel [dx, dy]

undo(): identical to crop/expand undo (full snapshot is stored either way)
```

## Trade-offs

| Choice | Rationale |
|---|---|
| Store full cell snapshots (not deltas) for resize undo | Resize changes every pixel in Scale mode; delta encoding offers no saving and adds complexity |
| Top-left anchor only | Covers 95% of use cases; centre-anchor can be added later as a preset offset |
| Nearest-neighbour only for Scale | Pixel art must not be blurred; bilinear/bicubic are wrong for this medium |
| New "Canvas" menu, not inside "File" | Canvas operations are a distinct category; "File" is for project I/O |

## Risks
- Scale on a large multi-frame project (e.g. 640×360 × 30 frames × 4 layers) stores ~330 MB of snapshot data. Acceptable because the undo stack can only hold a finite number of entries and the user will rarely scale large multi-frame projects. No mitigation needed for MVP.
