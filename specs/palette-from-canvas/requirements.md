# Color Count + Palette from Canvas — Requirements

## Problem statement
Pixel art is palette-constrained by nature — game engines and retro platforms impose color limits (16, 32, 64 colors). Artists need to know how many unique colors they're using and quickly build a working palette from their actual artwork. Currently RaBIT has no way to derive a palette from the canvas or even tell the user how many colors exist in the active frame.

## User stories
- As a pixel artist, I want to see the number of unique colors in the active frame at a glance so I can monitor my color budget.
- As a pixel artist, I want to auto-generate palette swatches from all unique colors in the current frame so I can manage my palette without manually picking each color.
- As a pixel artist, I want the palette-generation to replace or append to the existing palette so I have control over the workflow.

## Acceptance criteria
- WHEN a project is open THEN a color count indicator is shown in the palette panel header (e.g. "12 colors").
- WHEN the layer data changes (paint, undo, redo) THEN the color count updates automatically.
- WHEN I click "Build from Canvas" THEN all unique RGBA values (alpha > 0) across all visible layers of the active frame are collected and added as palette swatches.
- WHEN transparent pixels (alpha = 0) exist THEN they are NOT included in the color count or palette generation.
- WHEN "Build from Canvas" is invoked THEN duplicate colors are deduplicated.
- WHEN "Build from Canvas" is invoked with "Replace" mode THEN the existing palette is cleared first; with "Append" mode existing swatches are kept.
- WHEN the palette is built THEN it is undoable via palette history (or at minimum a confirmation dialog is shown before Replace).

## Out of scope
- Color quantization / reducing to N colors (palette reduction algorithms).
- Cross-frame color counting.
- Automatic palette sorting (hue/brightness) — may be added later.

## Open questions
- Replace vs Append: show a small dialog or two separate buttons? Recommendation: two buttons ("Replace" and "Append to Palette") in the palette panel to avoid a modal.
