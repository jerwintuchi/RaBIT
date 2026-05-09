# Canvas Resize — Stage 1: Requirements

## Problem statement
Once a project is created there is no way to change the canvas dimensions. Artists regularly need to adjust canvas size mid-project — cropping to a tighter frame, expanding for more background space, or rescaling a low-res sprite for a higher-resolution tileset.

## User stories
- As an artist, I want to crop my canvas so that I can remove empty space around my sprite without losing work outside the new bounds on undo.
- As an artist, I want to expand my canvas so that I can add more drawing area without disturbing existing pixels.
- As an artist, I want to nearest-neighbour scale my entire canvas so that I can convert a 32×32 sprite to 64×64 pixel-doubled output.
- As an artist, I want resize to be fully undoable so that I can recover from accidental crops instantly.

## Acceptance criteria
- WHEN the user opens Canvas → Resize Canvas, THEN a dialog appears showing current dimensions and a mode selector.
- WHEN mode is **Crop / Expand** and new dimensions are smaller, THEN pixels outside the new bounds are clipped; undo restores them exactly.
- WHEN mode is **Crop / Expand** and new dimensions are larger, THEN the new area is transparent; undo restores original dimensions.
- WHEN mode is **Scale (nearest-neighbour)** and the user confirms, THEN all pixel data across all layers and all frames is resampled; undo restores original data.
- WHEN Scale mode is selected, THEN a visible warning states the operation is lossy beyond undo.
- WHEN the new dimensions equal the current dimensions, THEN the Create button is disabled.
- WHEN the new dimensions exceed 640 px on either side, THEN the input is marked invalid and Create is disabled.
- WHEN resize is confirmed, THEN one entry appears in the undo history labelled "Resize canvas W×H → W′×H′".
- WHEN the user presses Escape or Cancel, THEN no change is made.

## Out of scope
- Anchor-point selection (top-left, centre, etc.) — always crops/expands from top-left for now.
- Per-layer resize (all layers resize together).
- Export-only scaling (this resizes the project canvas, not just the exported image).

## Open questions
- None — design is agreed.
