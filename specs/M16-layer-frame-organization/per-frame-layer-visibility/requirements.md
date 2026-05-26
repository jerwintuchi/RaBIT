# Per-Frame Layer Visibility — Requirements

## Problem Statement
Some layers should only appear on specific frames — a "hit flash" effect layer, a damage indicator, a blink cycle. Currently a layer is either visible on all frames or none. This forces artists to duplicate layers or manually paint empty cells, which is error-prone and wasteful.

## User Stories
- As an animator, I want to hide a specific layer on specific frames so I can have per-frame effects without duplicating layers.
- As an animator, I want a clear visual indicator in the timeline showing which frames a layer is hidden on, so I can track the visibility pattern at a glance.
- As an animator, I want to toggle per-frame visibility directly in the timeline cell so it's fast to set up.

## Acceptance Criteria
- WHEN the user right-clicks a frame cell in the timeline, THEN a context menu includes "Hide layer on this frame" / "Show layer on this frame" (toggled based on current state).
- WHEN a layer is hidden on a specific frame, THEN that frame cell in the timeline shows a distinct visual indicator (e.g. a diagonal stripe or "hidden" icon overlay).
- WHEN the renderer composites a frame, THEN layers with per-frame visibility overrides respect those overrides — a globally-visible layer that is hidden on frame N is not rendered on frame N.
- WHEN the layer's global visibility is OFF, THEN per-frame visibility overrides have no effect (global takes precedence).
- WHEN the user applies "Show on all frames" or "Hide on all frames" from the context menu, THEN all per-frame overrides for that layer are cleared/set in one action.
- Per-frame visibility data is saved in the .rabit file format.
- All per-frame visibility changes are undoable.

## Out of Scope
- Per-frame opacity (separate from visibility).
- Copying visibility patterns between layers.
- Keyframe animation of opacity values.

## Open Questions
- Should the eye icon in the layer label column of the timeline reflect the per-frame state of the currently active frame, or always show the global state? (Proposed: show global state; per-frame indicators are only in the cell grid.)
