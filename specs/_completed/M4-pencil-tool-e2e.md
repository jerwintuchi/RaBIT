# M4 — Walking Skeleton: Pencil Tool End-to-End

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete (Internal Alpha checkpoint)

## What was built
- ToolEngine state machine + pointer normalization in `src/core/ToolEngine/`
- PencilTool in `src/core/tools/PencilTool.ts`
- DrawCommand with delta-based pixel storage in `src/core/commands/DrawCommand.ts`
- Undo/Redo wired to useHistoryStore
- ToolBar UI with Pencil button in `src/ui/toolbar/ToolBar.tsx`
- Cursor swap on tool activation
- Verified: 1000-pixel stroke at 60fps; single undo removes full stroke; undo <50ms on 4096×4096; cross-layer isolation confirmed

## Reference
- `docs/architecture.md` §tool-engine — tool state machine
- `docs/architecture.md` §command-system — delta storage per stroke
