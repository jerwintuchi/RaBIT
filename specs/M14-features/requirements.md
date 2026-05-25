# M14 — Feature Expansion Requirements

## Problem Statement
RaBIT v1.0 ships P0 MVP features. This milestone delivers the highest-value P1 features requested by game developers and pixel artists: animation export (GIF), non-destructive drawing aids (tile mode, mirror mode, reference layer), canvas transforms, selection tools, and sprite preview (nine-slice). These collectively close the gap with Aseprite's most-used features.

---

## Feature 1 — GIF Export

### User Stories
- As a game dev, I want to export my animation as a GIF so I can share it on social media or embed it in a README.
- As an artist, I want to control loop count and frame delays so the exported GIF matches my intended playback speed.

### Acceptance Criteria
- WHEN the user selects File → Export → Animated GIF
- THEN a dialog appears with: output path picker, scale factor (1×/2×/4×), loop count (0 = infinite), per-frame delay override (ms), and color dithering toggle
- WHEN export is confirmed
- THEN a GIF is written to disk; each frame is composited and color-quantized to ≤ 256 colors using median-cut; per-frame delays are sourced from the frame's `durationMs` field; progress events are emitted
- THEN export completes in < 5 seconds for 100 frames at 256×256
- WHEN export fails
- THEN a toast error is shown with the reason

### Out of Scope
- Animated WebP, APNG
- Frame sub-selection (always exports all frames)

---

## Feature 2 — Tile / Seamless Mode

### User Stories
- As a game dev, I want to see my canvas tiled in a 3×3 grid around the main canvas so I can verify seamless texture edges while I paint.
- As a tileset artist, I want tile mode to be toggleable so it doesn't clutter normal use.

### Acceptance Criteria
- WHEN the user toggles View → Tile Mode (or keyboard shortcut T)
- THEN the canvas viewport renders the current frame composited and tiled 3×3 (one center + 8 surrounding copies) at the current zoom level
- WHEN the user paints on the center tile
- THEN the surrounding tiles update in real time (same GPU texture, no copy needed)
- WHEN tile mode is off
- THEN the viewport renders exactly as before
- The tile grid does NOT affect the exported file

### Out of Scope
- Hex-grid tiling, isometric tiling
- Painting on surrounding tiles (center only is editable)

---

## Feature 3 — Transform Tools (Flip H/V, Rotate 90°)

### User Stories
- As a pixel artist, I want to flip the active layer horizontally or vertically so I can mirror a character sprite.
- As an artist, I want to rotate the canvas content 90° CW/CCW so I can repurpose artwork for different orientations.

### Acceptance Criteria
- WHEN the user selects Edit → Flip Horizontal / Flip Vertical / Rotate 90° CW / Rotate 90° CCW
- THEN the operation applies to the active layer only, on the active frame
- THEN the operation is undoable (stored as a Command with before/after pixel data delta)
- Flip: mirrors pixel data in-place (same canvas dimensions)
- Rotate 90°: if canvas is not square, the canvas dimensions are swapped (e.g. 64×32 → 32×64); user is warned if this would change canvas size
- THEN the GPU layer texture is updated immediately

### Out of Scope
- Arbitrary angle rotation
- Rotate all layers / all frames at once (single layer per operation)
- Sub-pixel transforms

---

## Feature 4 — Mirror Mode

### User Stories
- As a character artist, I want to draw with horizontal symmetry so both sides of a character are painted simultaneously.
- As an artist, I want to optionally enable vertical symmetry too.

### Acceptance Criteria
- WHEN the user toggles Mirror Mode (axis: horizontal, vertical, or both) via toolbar or shortcut
- THEN every brush stroke is mirrored across the center axis of the canvas in real time on the scratch buffer
- WHEN the stroke is committed (pointerUp)
- THEN both the original and mirrored pixels are written to the layer as a single Command
- The mirror axis guide line is drawn as a faint overlay on the canvas (non-destructive)
- Mirror mode state persists across frames but is not saved to the project file

### Out of Scope
- Radial/rotational symmetry
- Per-layer mirror axes

---

## Feature 5 — Reference Image Layer

### User Stories
- As a pixel artist, I want to load a reference image (PNG/JPG) into the viewport so I can trace or compare proportions while painting.
- As an artist, I want to control the reference image's opacity and position without affecting my artwork.

### Acceptance Criteria
- WHEN the user selects File → Add Reference Image
- THEN a file picker opens (PNG, JPG, WEBP accepted)
- THEN the image is rendered as a non-paintable overlay in the canvas viewport, below or above all layers (user-configurable)
- WHEN the user drags the reference image
- THEN it repositions freely within the viewport
- WHEN the user adjusts opacity (0–100%)
- THEN the reference image blends accordingly
- The reference image is NOT exported (PNG, GIF, spritesheet) and NOT saved to the project file

### Out of Scope
- Multiple reference images simultaneously
- Reference image scaling/rotation handles

---

## Feature 6 — Selection Tools

### User Stories
- As a pixel artist, I want to select a rectangular region so I can cut, copy, paste, move, or delete that area.
- As an artist, I want to use magic wand to select a contiguous region of same-colored pixels.

### Acceptance Criteria

**Rectangular Marquee (already partially implemented):**
- WHEN the user drags with the Marquee tool
- THEN a marching-ants rectangle is shown
- WHEN the selection exists, Edit menu shows: Cut, Copy, Paste, Delete Selection, Select All, Deselect

**Magic Wand:**
- WHEN the user clicks with the Wand tool
- THEN all contiguous pixels within the tolerance threshold are selected (flood-fill variant)
- Tolerance is adjustable via tool options (0–255)

**Selection operations:**
- Cut: copies selected pixels to clipboard, fills selection with transparent
- Copy: copies selected pixels
- Paste: pastes as a floating selection that can be moved then committed
- Delete: fills selection with transparent
- Select All: selects entire canvas
- Deselect: clears selection
- All operations are undoable

### Out of Scope
- Lasso (freehand) selection
- Feathering / anti-aliased selection edges
- Transform (scale/rotate) of selection content

---

## Feature 7 — Nine-Slice Preview

### User Stories
- As a game UI developer, I want to define the nine-slice margins of a sprite so I can preview how it stretches in a UI panel.

### Acceptance Criteria
- WHEN the user opens the Nine-Slice Preview panel (View → Nine-Slice Preview)
- THEN a panel appears showing: the current frame composited, four margin sliders (top/right/bottom/left in pixels), and a live preview of the sprite stretched to a configurable target size
- WHEN the user adjusts margins
- THEN the nine-slice stretch preview updates in real time
- WHEN the user resizes the preview target
- THEN the stretched result updates
- Margin values are not saved to the project file (session-only)

### Out of Scope
- Exporting nine-slice metadata
- Animated nine-slice preview

---

## Open Questions
1. **GIF color quantization**: use `color_quant` (already a dep) median-cut, or add `imagequant` for better quality? `color_quant` is already in Cargo.toml — use it first.
2. **Rotate 90° canvas resize warning**: show a modal confirm, or just do it with an undo-able command?
3. **Mirror mode shortcut**: `M` conflicts with nothing currently — confirm.
4. **Selection clipboard**: use in-memory pixel buffer (session only), not system clipboard — confirm.
5. **Reference image storage**: keep decoded RGBA in JS memory only, not in the project file — confirm.
