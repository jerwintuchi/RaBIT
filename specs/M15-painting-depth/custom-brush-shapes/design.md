# Custom Brush Shapes — Design

## Approach
`BrushTool.paintPixel(x, y)` currently paints exactly one pixel. We generalise it into `paintFootprint(cx, cy)` that iterates over a pre-computed set of offsets (the brush shape) and calls the existing `paintPixelAt` logic for each. The footprint is re-computed whenever size or shape changes (cheap, done at stroke-start). Pixel-perfect mode forces size=1 and disables the shape selector. A DOM overlay in `CanvasViewport` renders the cursor preview.

Stamp mode is deferred — it depends on floating-selection plumbing that is already substantial; adding it atomically here risks scope creep.

## Affected Components

| File | Change |
|---|---|
| `src/core/DataModel/types.ts` | Add `BrushShape = 'square' \| 'round'` type alias |
| `src/core/ToolEngine/types.ts` | Add `getBrushOptions(): { size: number; shape: BrushShape }` to `ToolEngineContext` |
| `src/core/tools/BrushTool.ts` | Replace single `paintPixel` call with `paintFootprint`; compute offsets once on `pointerDown` |
| `src/core/tools/PencilTool.ts` | Update `describe()` to include size |
| `src/state/useToolStore.ts` | Extend `PencilOptions` and `EraserOptions` with `brushShape: BrushShape`; increase default size from 1 already exists, just add shape |
| `src/state/toolBridge.ts` | Implement `getBrushOptions()` reading `useToolStore` |
| `src/ui/toolbar/ToolBar.tsx` | Add options strip (size chips + shape toggle) when pencil or eraser is active |
| `src/ui/canvas/CanvasViewport.tsx` | Add brush-cursor overlay `<canvas>` positioned over the WebGL canvas; update on mouse move and options change |

## Data Model Changes
No persistent data model changes. `BrushShape` is a new type in `core/DataModel/types.ts`. `PencilOptions.brushShape` and `EraserOptions.brushShape` are new fields in the tool store (session-only; not persisted to prefs for now).

## Key Flows

### Stroke with multi-pixel brush
1. `pointerDown` → `BrushTool.onPointerDown` computes `offsets[]` from size + shape, stores on instance.
2. Each `paintFootprint(cx, cy)` iterates offsets and calls `paintPixelAt(cx+dx, cy+dy)` (existing bounds/selection guards apply per pixel).
3. Mirror mode applies per-pixel as before.
4. Pixel-perfect elbow detection is disabled when size > 1 (the elbow heuristic only makes sense for 1px strokes).
5. `pointerUp` → `DrawCommand` committed with all deltas as normal.

### Brush footprint computation
```ts
function computeOffsets(size: number, shape: BrushShape): Array<{dx: number; dy: number}> {
  const r = Math.floor(size / 2);
  const offsets: {dx: number; dy: number}[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (shape === 'square' || dx * dx + dy * dy <= r * r) {
        offsets.push({ dx, dy });
      }
    }
  }
  return offsets;
}
```
For size=1, this always returns `[{dx:0,dy:0}]` — identical to current behaviour.

### Cursor overlay
- A `<canvas>` element is absolutely-positioned over the WebGL canvas with `pointer-events: none`.
- On mouse move, clear the overlay and draw a 1px rect (or circle) outline at the cursor position, scaled by `zoom`.
- On options change, the overlay is redrawn at the last known cursor position.
- Hide the native browser cursor when over the canvas (`cursor: none`).

### `[`/`]` shortcuts
- Add `'brush.sizeDecrease': '['` and `'brush.sizeIncrease': ']'` to `DEFAULT_KEYBINDINGS`.
- Handle in `useViewportInteraction.ts` `onKeyDown`, only when pencil or eraser is active.

## Trade-offs
- **Offsets computed at stroke-start (not per-move)**: size/shape cannot change mid-stroke. Acceptable — no paint app allows this.
- **CPU footprint loop instead of GPU**: for sizes up to 16px the footprint is ≤256 pixels — the overhead vs GPU dispatch is negligible.
- **Stamp mode deferred**: reduces scope; the selection clipboard already stores pixel data so it can be added later as a thin layer on top of this.

## Risks
- `ToolEngineContext` interface changes are breaking — every implementation must add `getBrushOptions()`. Only `toolBridge.ts` implements it, so impact is contained.
