# M6 — Layer Panel + Layer Operations

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete

## What was built
- LayerPanel in `src/ui/panels/LayerPanel/LayerPanel.tsx`
- LayerRow with visibility/lock toggles in `src/ui/panels/LayerPanel/LayerRow.tsx`
- LayerThumbnail with ≤4Hz throttled update in `src/ui/panels/LayerPanel/LayerThumbnail.tsx`
- Layer operations (all undoable): Add, Delete, Duplicate, Merge Down, Rename, Reorder
- LayerCommands in `src/core/commands/LayerCommands.ts`
- Layer action composers in `src/state/action-composers/layer-actions.ts`
- Locked-layer drawing is a no-op with cursor feedback
- Drag-to-reorder with drop indicator

## Reference
- `docs/PRD.md` §layer-system — layer operation requirements
- `docs/design-system.md` §layer-panel — visual spec
