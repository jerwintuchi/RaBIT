# Lasso Selection Tool — Requirements

## Problem statement
RaBIT has rectangular (Marquee) and flood-fill (Magic Wand) selection, but no freehand selection. Pixel artists frequently need to select irregular shapes that don't align to a rectangle and aren't contiguous by color — e.g., cutting out a custom silhouette, selecting one arm of a character, or grabbing a specific region across several colors. Without a lasso, users must use marquee + manual pixel editing or magic wand with careful tolerance tuning as a workaround.

## User stories
- As a pixel artist, I want to draw a freehand closed path on the canvas so that I can select any arbitrary pixel region.
- As a pixel artist, I want the selection to auto-close when I release the mouse so I don't need to manually trace back to the start point.
- As a pixel artist, I want the lasso to respect the current selection modifier keys (add/subtract) so I can build complex selections incrementally — out of scope for this milestone, listed under Open Questions.
- As a pixel artist, I want the lasso overlay to show my path as I draw so I can see exactly what I'm selecting.

## Acceptance criteria
- WHEN I select the lasso tool AND click-drag on the canvas THEN a freehand path is drawn following my pointer.
- WHEN I release the pointer THEN the path is auto-closed (straight line from last point to first point) and converted to a filled pixel mask.
- WHEN the lasso path encloses a region THEN all pixels inside the closed polygon are included in the selection mask.
- WHEN the path is shorter than 3 pixels (a tap rather than a drag) THEN no selection is created and any existing selection is cleared.
- WHEN a lasso selection exists AND I click the lasso tool again THEN the existing selection is replaced.
- WHEN the lasso is active AND I press Escape THEN the in-progress path is cancelled and no selection is set.
- WHEN a lasso selection is active THEN the marching-ants outline follows the actual lasso shape (uses the existing pixel-boundary path renderer, same as magic wand).

## Out of scope
- Polygonal lasso (click to anchor points) — freehand only for this milestone.
- Add-to / subtract-from selection modifier keys.
- Moving the lasso selection (the existing MarqueeTool move-mode handles this once the selection mask is set, but the lasso tool itself does not enter move mode).

## Open questions
- Should the lasso tool auto-switch to move mode (like MarqueeTool) when clicking inside an existing lasso selection? Recommendation: No — keep lasso as selection-only; use MarqueeTool for moving. Simpler and consistent with Photoshop's lasso behavior.
