# Pixel-Perfect Drawing Mode — Requirements

## Problem statement
When drawing diagonal strokes with the pencil/brush, Bresenham's algorithm produces L-shaped "elbows" — places where two adjacent diagonal pixels share a corner and create a visually thick knuckle. Pixel artists manually avoid this by hand; professional pixel art tools eliminate it automatically. Without pixel-perfect mode, RaBIT produces the same ugly staircase artifacts as MS Paint.

## User stories
- As a pixel artist, I want a pixel-perfect toggle on the pencil so that my diagonal strokes look like true 1-pixel-wide lines without manual correction.
- As a pixel artist, I want the toggle to be remembered per session so I don't have to re-enable it every time I pick the pencil.
- As a pixel artist using the eraser, I want the same pixel-perfect behavior available so I can erase along clean diagonals too.

## Acceptance criteria
- WHEN pixel-perfect mode is ON AND I draw a diagonal stroke THEN no two consecutive pixels share both an x-adjacent and y-adjacent neighbor (no L-shaped elbows).
- WHEN pixel-perfect mode is OFF THEN stroke behavior is identical to current Bresenham output (no regression).
- WHEN I single-click (no drag) THEN exactly one pixel is painted regardless of the toggle state.
- WHEN the toggle changes THEN the current stroke is not affected; the new setting applies from the next stroke.
- WHEN I draw a perfectly horizontal or vertical line THEN pixel-perfect mode has no visual effect (no pixels removed).
- WHEN pixel-perfect mode is ON AND the eraser is active THEN the same elbow-removal logic applies to erased pixels.

## Out of scope
- Pixel-perfect mode on Line, Rectangle, or Ellipse tools (those use different geometry).
- Sub-pixel pressure sensitivity.
- Configuring elbow-detection window beyond the standard 3-point check.

## Open questions
- None — the algorithm is well-established: after placing each pixel, check if the previous pixel forms a non-diagonal transition with the one before it; if so, remove the previous pixel from the stroke.
