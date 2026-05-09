# M2 — Editor Core: Data Types + Stores + Command System

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete

## What was built
- All data model types from `docs/data-model.md §2` in `src/core/DataModel/types.ts`
- Factories, color conversion, palette import utilities in `src/core/DataModel/`
- CommandManager with execute/undo/redo/merge/trim in `src/core/CommandSystem/`
- CommandManager unit tests covering all operations
- 7 Zustand stores: useProjectStore, useLayerStore, useFrameStore, useHistoryStore, usePaletteStore, useToolStore, useUIStore
- Action composers for cross-store logic in `src/state/action-composers/`
- ESLint `no-restricted-paths` rule confirming no React in `src/core/` or `src/state/`

## Reference
- `docs/data-model.md` §2 — in-memory data model
- `docs/architecture.md` §command-system — delta-based undo design
