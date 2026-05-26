# Custom Brush Shapes — Requirements

## Problem Statement
RaBIT currently only supports a 1×1 pixel brush. Pixel artists routinely need larger brushes (round, square) to shade, fill areas, or stamp repeated motifs. Without them, RaBIT is slower to use than any competing tool.

## User Stories
- As an artist, I want to pick a brush size (1px–16px) so I can shade large areas without clicking every pixel.
- As an artist, I want round and square brush shapes so the stroke feels natural for the style I'm working in.
- As an artist, I want to paint with my current selection as a stamp so I can repeat a motif precisely.
- As an artist, I want a visual cursor showing the brush footprint so I know exactly what will be painted.

## Acceptance Criteria
- WHEN the user selects Pencil or Eraser, THEN a brush size picker (1, 2, 3, 5, 7, 9, 13, 16) is shown in the toolbar options strip.
- WHEN the user selects a size > 1, THEN a shape toggle (square / round) is also shown.
- WHEN the user paints with a size-N brush, THEN every pixel within the N×N square (or N-diameter circle) footprint is painted in one stroke tick.
- WHEN pixel-perfect mode is active, THEN brush size is locked to 1 (shape options hidden).
- WHEN the user hovers the canvas, THEN the cursor is replaced with an outline preview of the brush footprint at canvas scale.
- WHEN the user has an active selection, THEN a "Stamp" button appears in the toolbar options strip; clicking it enters stamp mode where pointer-down pastes the selection content at the cursor position each tick.
- Brush size and shape persist across sessions (saved to preferences).

## Out of Scope
- Custom freehand-drawn brush shapes.
- Pressure sensitivity / tablet tilt.
- Anti-aliased brushes (would break pixel-art aesthetics).

## Open Questions
- Should brush size be settable via `[` and `]` shortcuts like most paint apps? (Assumed yes.)
