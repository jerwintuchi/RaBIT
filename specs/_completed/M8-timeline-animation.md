# M8 — Frames + Timeline + Animation + Onion Skinning

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete

## What was built
- Timeline component in `src/ui/panels/Timeline/Timeline.tsx`
- Frame operations (all undoable): Add, Delete, Duplicate, Reorder, Reverse, Set Duration
- Cell operations: Clear, Link, Unlink
- Playback engine: Play, Pause, Loop, FPS control
- Onion skinning support in RenderingEngine (onionBuffer)
- Tags for named frame ranges
- FrameCommands in `src/core/commands/FrameCommands.ts`
- useFrameStore with reducer
- Frame action composers in `src/state/action-composers/frame-actions.ts` and `frame-utils.ts`
- Verified: 24-frame loop at 24fps with 4 layers — smooth, no dropped frames; timeline scrolls at 60fps for 200+ frames

## Reference
- `docs/PRD.md` §animation — frame and timeline requirements
- `docs/architecture.md` §animation-data-model — cell linking, tag model
- `docs/design-system.md` §timeline — timeline visual spec
