# Per-Frame Layer Visibility — Tasks

## Task 1 — Add `hiddenLayerIds` to `Frame`
**Files:** `src/core/DataModel/types.ts`, `src/core/DataModel/factories.ts`
- Add `hiddenLayerIds: LayerId[]` to `Frame` interface (default `[]`)
- Update `makeFrame()` factory to include `hiddenLayerIds: []`
**Acceptance:** `pnpm typecheck` — expect downstream errors; fixed in following tasks.

## Task 2 — Rust DTO backward compat
**Files:** `src-tauri/src/project_io/dto.rs`
- Add `hidden_layer_ids: Vec<String>` to `FrameDto` with `#[serde(default)]`
- Hydration: serialize/deserialize as normal; missing field in old files → empty vec
**Acceptance:** `cargo build` passes; existing `.rabit` files still deserialize.

## Task 3 — `SetFrameLayerVisibilityCommand`
**Files:** `src/core/commands/FrameCommands.ts`
- New command: `SetFrameLayerVisibilityCommand`
- Constructor: `frameId: FrameId, layerId: LayerId, hidden: boolean, deps`
- `execute()`: if `hidden`, add `layerId` to `frame.hiddenLayerIds`; else remove it
- `undo()`: reverse
- `description`: `'Hide layer on frame'` / `'Show layer on frame'`
- Also add `SetFrameLayerVisibilityBatchCommand` that applies the same `hidden` value to every frame (for "hide on all frames" / "show on all frames")
**Depends on:** Task 1
**Acceptance:** `pnpm typecheck` passes.

## Task 4 — `setFrameLayerHidden` action-composer
**Files:** `src/state/action-composers/frame-actions.ts`
- `setFrameLayerHidden(frameId, layerId, hidden)` — dispatch `SetFrameLayerVisibilityCommand`
- `setFrameLayerHiddenAll(layerId, hidden)` — dispatch `SetFrameLayerVisibilityBatchCommand` across all frames
**Depends on:** Task 3
**Acceptance:** `pnpm typecheck` passes.

## Task 5 — Renderer respects per-frame visibility
**Files:** `src/render/RenderingEngine.ts`
- Read the rendering path that consults `layer.visible`
- Extend the per-frame layer filter to also exclude layers in `frame.hiddenLayerIds`
- The check: `layer.visible && !(frame.hiddenLayerIds ?? []).includes(layer.id)`
**Depends on:** Task 1
**Acceptance:** `pnpm build` passes; hidden layer does not appear in render for its frame.

## Task 6 — Timeline frame cell right-click context menu
**Files:** `src/ui/panels/Timeline/Timeline.tsx`
- `FrameCell` gains `hiddenLayerIds: string[]` prop (passed from parent which reads from the frame)
- Add `onContextMenu` to the cell's outer `<div>`: build a small context menu with:
  - "Hide layer on this frame" / "Show layer on this frame" (toggled by whether `layerId` is in `hiddenLayerIds`)
  - Separator
  - "Hide on all frames" / "Show on all frames"
- Use the existing `ContextMenu` primitive
- Wire to `frameActions.setFrameLayerHidden` and `frameActions.setFrameLayerHiddenAll`
**Depends on:** Task 4
**Acceptance:** Right-click shows context menu; actions update state correctly; `pnpm typecheck` passes.

## Task 7 — Visual indicator in hidden frame cells
**Files:** `src/ui/panels/Timeline/Timeline.tsx`, `Timeline.module.css`
- When `hiddenLayerIds.includes(layerId)`, `FrameCell` adds a `<div className={styles.frameCellHidden} />` overlay
- CSS: diagonal stripe pattern using `repeating-linear-gradient`
**Depends on:** Task 6
**Acceptance:** Hidden cells show stripe overlay in timeline; `pnpm typecheck` passes.

## Task 8 — Verification
- Run `pnpm build` — 0 errors; `cargo build` — 0 errors
- Run `pnpm test` — all pass
- Manual: hide a layer on frame 2 only; play animation; verify layer invisible only on frame 2; verify undo restores; save + reload project; verify per-frame state persists
