# M5 — Remaining MVP Drawing Tools

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete

## What was built
- Tools in `src/core/tools/`: BrushTool, EraserTool, LineTool, FillTool, EyedropperTool, HandTool, ZoomTool, MarqueeTool (P1 preview), EllipseTool, RectangleTool, MoveTool
- All tools follow the same ToolEngine state machine pattern as PencilTool
- Keyboard shortcuts (B/E/L/G/I/H/Z) switch active tool
- Space held → temporary Hand tool
- Tool options bridge in `src/state/toolBridge.ts`
- Verified: flood fill on 4096×4096 canvas <300ms

## Reference
- `docs/PRD.md` §drawing-tools — P0 tool requirements
- `docs/architecture.md` §tool-engine — tool pattern all tools follow
