# M11 — PNG + Spritesheet Export — Stage 1: Requirements

## Problem Statement
Users cannot get their work out of RaBIT into game engines or image tools. Export to PNG (single frame or spritesheet) is a P0 deliverable required for the internal beta checkpoint.

## User Stories
- As a game developer, I want to export a single frame as a PNG so that I can use it as a game asset.
- As a game developer, I want to export all frames as a spritesheet PNG so that I can import it into Godot or Unity.
- As a game developer, I want a sidecar JSON file alongside the spritesheet so that my game engine knows frame dimensions, count, and tags.
- As a pixel artist, I want export to run in the background so that I can keep editing while it finishes.

## Acceptance Criteria
- WHEN I choose File → Export → PNG (current frame), THEN a pixel-identical PNG is written to the chosen path.
- WHEN I choose File → Export → Spritesheet, THEN a PNG with all frames tiled is written and a sidecar JSON is written alongside it.
- WHEN the sidecar JSON is imported into Godot/Unity, THEN frame count, dimensions, and tag names are correctly represented.
- WHEN exporting 100 frames × 256×256, THEN export completes in <5 seconds.
- WHEN export is in progress, THEN the UI remains responsive and the user can continue editing.
- WHEN an ASE palette file is used, THEN a warning banner is shown (undocumented format disclaimer).

## Out of Scope
- GIF export (P1 — M14+)
- APNG export
- Indexed color export
- Export queue / batch export

## Open Questions
- None — `docs/PRD.md` §export and `docs/data-model.md` §5 specify formats and layout options.

## Source References
- `docs/PRD.md` §export — P0 export requirements
- `docs/data-model.md` §5 — PNG/spritesheet export options and sidecar JSON schema
- `docs/stack.md` — `image` and `png` Rust crates approved for export
