# Per-Frame Layer Visibility — Design

## Approach
Add `hiddenLayerIds: string[]` to the `Frame` type. The renderer checks this list in addition to the global `layer.visible` flag when deciding whether to draw a layer for a given frame. A new command `SetFrameLayerVisibilityCommand` toggles entries in the list. The timeline exposes the toggle via a right-click context menu on frame cells, and shows a visual indicator (striped overlay) on cells where the layer is hidden.

## Affected Components

| File | Change |
|---|---|
| `src/core/DataModel/types.ts` | Add `hiddenLayerIds?: string[]` to `Frame` |
| `src/core/DataModel/factories.ts` | Initialize `hiddenLayerIds: []` in `makeFrame()` |
| `src/core/commands/FrameCommands.ts` | Add `SetFrameLayerVisibilityCommand` |
| `src/state/action-composers/frame-actions.ts` | `setFrameLayerHidden(frameId, layerId, hidden)` action |
| `src/render/RenderingEngine.ts` | Check `frame.hiddenLayerIds.includes(layerId)` when building per-frame layer specs |
| `src/ui/panels/Timeline/Timeline.tsx` | Right-click `FrameCell` → context menu with hide/show toggle |
| `src/ui/panels/Timeline/Timeline.module.css` | `.frameCellHidden` stripe overlay style |
| `src-tauri/src/project_io/dto.rs` | Add `hidden_layer_ids: Vec<String>` to `FrameDto` with `#[serde(default)]` |

## Data Model Changes

```ts
export interface Frame {
  id: FrameId;
  duration: number;
  cells: Record<LayerId, Cell>;
  hiddenLayerIds: LayerId[]; // new — default []
}
```

Backward compat: `#[serde(default)]` in Rust DTO; JS hydration treats missing field as `[]`.

## Key Flows

### Renderer integration
The renderer already accepts a layer spec array. Before building specs for frame `fi`, filter:
```ts
const frameHidden = new Set(frames[fi].hiddenLayerIds ?? []);
const visibleLayers = layers.filter(l =>
  l.visible && !frameHidden.has(l.id)
);
```
This replaces the existing `l.visible` check with a two-condition guard.

### SetFrameLayerVisibilityCommand
```ts
class SetFrameLayerVisibilityCommand implements Command {
  description: string;
  execute() { toggleHiddenInFrame(frameId, layerId, hidden); }
  undo()    { toggleHiddenInFrame(frameId, layerId, !hidden); }
}
```

### Timeline right-click context menu
`FrameCell` gains an `onContextMenu` handler. The menu shows:
- "Hide layer on this frame" (if not currently hidden)
- "Show layer on this frame" (if currently hidden)
- Separator
- "Hide on all frames" → sets `hiddenLayerIds` to contain `layerId` on every frame
- "Show on all frames" → removes `layerId` from `hiddenLayerIds` on every frame

"Hide/show on all frames" dispatches a single batch command.

### Visual indicator
When a layer is hidden on a specific frame, `FrameCell` renders an additional `<div className={styles.frameCellHidden} />` overlay:
```css
.frameCellHidden {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.35) 3px,
    rgba(0, 0, 0, 0.35) 4px
  );
  pointer-events: none;
}
```

## Trade-offs
- **Array not Set in data model**: `hiddenLayerIds` stored as `string[]` for JSON compatibility. Converted to `Set` at lookup time in hot paths (renderer, cell render check).
- **Global visibility takes precedence**: if `layer.visible === false`, per-frame overrides are irrelevant — the layer is never rendered regardless. No special handling needed; the renderer's `l.visible` guard fires first.
- **No timeline eye icon change**: the eye icon in the layer label column reflects global visibility only. Per-frame state is communicated only through cell overlays. Avoids confusion from an icon that changes as you navigate frames.

## Risks
- Renderer must be called with the correct `activeFrameIndex` to apply per-frame visibility. Verify that every render-trigger path passes the current frame index (not a stale capture).
