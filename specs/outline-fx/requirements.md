# Outline Layer Effect — Requirements

## Problem statement
Pixel artists add a 1-pixel colored border (usually black) around every sprite as a standard finishing step. Without a built-in outline operation, users must do this by hand — painting each edge pixel individually — which is tedious and error-prone on complex sprites. Every professional pixel art tool (Aseprite, GraphicsGale) provides this as a one-click operation.

## User stories
- As a pixel artist, I want to apply a 1px outline to the active layer in one click so that I don't have to manually trace the sprite edge.
- As a pixel artist, I want to choose the outline color so that I can use black, white, or any custom color.
- As a pixel artist, I want the outline to be undoable so that I can experiment without fear.
- As a pixel artist, I want the outline to only affect transparent pixels adjacent to opaque content so that it doesn't paint over existing artwork.

## Acceptance criteria
- WHEN I invoke "Outline Layer" THEN every transparent pixel that is 4-directionally adjacent to an opaque pixel on the active layer is painted with the chosen color.
- WHEN a pixel is already opaque THEN it is NOT painted over (outline only touches transparent pixels).
- WHEN the active layer is locked THEN the action is disabled.
- WHEN no project is open THEN the action is disabled.
- WHEN the outline is applied THEN a single undoable DrawCommand is pushed to the history stack.
- WHEN I undo THEN all outline pixels are removed and the layer returns to its pre-outline state.
- WHEN the outline color is not specified THEN the current primary color is used.

## Out of scope
- 8-directional (diagonal) outline.
- Multi-pixel outline thickness.
- Outline as a non-destructive live layer effect.
- Per-frame outline (operates on the active frame's active layer only).

## Open questions
- Where is the outline action invoked? Recommendation: Edit menu item "Outline Layer" + Layer panel context menu (right-click on layer row). Both routes for discoverability.
