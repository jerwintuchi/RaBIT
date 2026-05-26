# Layer Groups / Folders — Requirements

## Problem Statement
Projects with many layers (character body parts, FX layers, background elements) become hard to navigate as a flat list. Grouping related layers into collapsible folders is standard in every professional compositor and is expected by artists working on complex sprites.

## User Stories
- As an artist, I want to create a layer group (folder) so I can organize related layers together.
- As an artist, I want to collapse a group so the layer panel doesn't scroll endlessly.
- As an artist, I want to toggle visibility and lock for an entire group at once.
- As an artist, I want to drag layers into and out of groups so I can reorganize without recreating layers.
- As an artist, I want the group's composite to respect its own blend mode and opacity so I can apply effects to the whole group.

## Acceptance Criteria
- WHEN the user clicks "Add group" (new button in Layer panel header), THEN a new empty group layer is created above the active layer.
- WHEN a group exists, THEN its rows in the Layer panel show a collapse toggle (chevron); clicking it hides/shows member rows.
- WHEN a group is collapsed, THEN the thumbnail shows a flat composite of its members.
- WHEN the user drags a layer row into a group header drop zone, THEN the layer becomes a member of that group.
- WHEN the user toggles visibility on a group, THEN all member layers inherit that visibility state (without changing their individual flags).
- WHEN the user toggles lock on a group, THEN all member layers are locked/unlocked together.
- WHEN rendering, THEN group members are composited together first (respecting each member's blend mode and opacity), then the resulting bitmap is composited onto the canvas below using the group's own blend mode and opacity.
- WHEN the user attempts to delete a group, THEN a confirmation prompt lists how many layers will be deleted.
- Groups nest only one level deep (no groups inside groups) for V1.
- Group state (members, collapse state, blend mode, opacity) is saved in the .rabit file format.

## Out of Scope
- Nested groups (groups within groups).
- Clipping masks (separate feature).
- Group-level FX (outline, etc.) — groups use existing blend/opacity controls only.

## Open Questions
- Should dragging a layer onto a group header (as opposed to inside it) move the layer above the group rather than into it? (Assumed yes.)
