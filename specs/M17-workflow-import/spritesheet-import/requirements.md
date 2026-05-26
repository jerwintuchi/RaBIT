# Spritesheet Import / Slice — Requirements

## Problem Statement
Artists frequently receive or download spritesheets (a single PNG with all animation frames laid out on a grid). RaBIT can export spritesheets but cannot import them. This makes RaBIT a dead-end for iterating on existing assets and breaks a common workflow.

## User Stories
- As an artist, I want to open a PNG spritesheet and have RaBIT slice it into individual frames so I can edit the animation.
- As an artist, I want to specify the grid cell size (width × height) so RaBIT knows where each frame boundary is.
- As an artist, I want a preview showing the slice grid overlaid on the image before committing, so I can verify the settings are correct.
- As an artist, I want to choose whether to import into a new project or append frames to the current project.

## Acceptance Criteria
- WHEN the user chooses File → Import Spritesheet, THEN a file picker opens accepting PNG/BMP/WebP.
- WHEN a file is chosen, THEN an import dialog opens showing a preview of the image with a configurable grid overlay.
- WHEN the user enters cell width and cell height, THEN the grid overlay updates live to show the resulting slices.
- WHEN columns and rows are auto-detected from image dimensions, THEN they appear pre-filled (image.width / cellW, image.height / cellH, rounded down).
- WHEN the user confirms, THEN:
  - If "New project": a new project is created with canvas size = cell size, one layer, and one frame per slice inserted in row-major order.
  - If "Append to current": frames are appended after the last frame; canvas size must match cell size or an error is shown.
- WHEN the sliced frame count would exceed 1000, THEN a warning is shown before importing.
- The import is a single undoable operation (or starts a fresh project, which is not undoable).

## Out of Scope
- Importing JSON sidecar metadata (Aseprite export format).
- Auto-detecting cell size from image content.
- Importing multiple spritesheets at once.

## Open Questions
- Should we support non-uniform grids (e.g. varying frame sizes)? (Assumed no for now — grid only.)
