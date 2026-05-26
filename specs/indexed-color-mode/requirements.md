# Indexed Color Mode — Requirements

## Problem Statement
Professional pixel artists work in a strict palette — every pixel must be one of the palette's swatches. RaBIT currently lets any RGBA value be painted, meaning accidental off-palette colors silently pollute the canvas. Indexed mode enforces palette discipline and is a defining feature of dedicated pixel art tools.

## User Stories
- As an artist, I want to toggle "indexed color mode" so that every paint operation snaps to the nearest palette color.
- As an artist, I want the eyedropper to only return palette entries in indexed mode so the color picker always shows a canonical swatch.
- As an artist, I want a "Quantize to palette" action that remaps all pixels in the active layer/frame to the nearest palette color in one step.
- As an artist, I want visual feedback in the color picker when the current primary color is not in the palette, so I can see when I'm about to paint off-palette.

## Acceptance Criteria
- WHEN indexed mode is OFF (default), THEN behavior is unchanged — any RGBA value can be painted.
- WHEN indexed mode is ON, THEN painting with pencil/eraser/fill/line/rect/ellipse snaps the painted color to the nearest palette swatch (by Euclidean distance in RGB space) before writing pixels.
- WHEN indexed mode is ON and the eyedropper picks a color, THEN the picked color is snapped to the nearest palette swatch.
- WHEN indexed mode is ON and the primary color has no exact match in the palette, THEN a warning indicator (e.g. small yellow dot) is shown in the color well.
- WHEN the user invokes "Quantize to palette" (Edit menu entry), THEN every pixel in the active layer/frame is remapped to the nearest palette swatch; the operation is undoable.
- WHEN the palette changes while indexed mode is ON, THEN no automatic re-quantization happens (artist must invoke explicitly).
- The indexed mode toggle persists across sessions (saved to preferences).

## Out of Scope
- Full indexed-color file format (all data stays RGBA internally; this is a paint constraint, not a storage format change).
- Dithering during quantization (plain nearest-neighbor only for now).
- Per-layer indexed mode.

## Open Questions
- Toggle location: toolbar options strip, View menu, or a dedicated button in the palette panel? (Proposed: palette panel header, since it's tightly coupled to palette.)
