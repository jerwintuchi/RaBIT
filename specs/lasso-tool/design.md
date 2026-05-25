# Lasso Selection Tool — Design

## Approach
Implement `LassoTool` as a new `Tool` class. During drag, collect canvas pixel coordinates into a polyline. On `pointerUp`, close the polyline and rasterize the polygon into a `SelectionMask` using a scanline fill algorithm. Display the in-progress path via the scratch buffer (1px white line on transparent) so the user can see the lasso as they draw.

## Affected components

| File | Change |
|---|---|
| `src/core/tools/LassoTool.ts` | New file — full lasso tool implementation |
| `src/core/tools/index.ts` | Export `LassoTool` |
| `src/state/toolBridge.ts` | Register `LassoTool` instance |
| `src/ui/toolbar/ToolBar.tsx` | Add lasso button (key: `L`) |
| `src/ui/canvas/CanvasViewport.tsx` | Add `L` → `'lasso'` to TOOL_KEYS keyboard map |

## Data model changes
No data model changes. `SelectionMask` already supports arbitrary masks. `ToolId = 'lasso'` already declared in `types.ts`.

## Key flows

### Drawing phase (pointerDown → pointerMove)
1. `onPointerDown`: initialize `_path = [{x, y}]`, `_active = true`, clear scratch.
2. `onPointerMove`: append current canvas position to `_path` (deduplicate consecutive identical points). Redraw the entire polyline onto scratch each frame using Bresenham between consecutive path points. Call `ctx.updateScratch(scratch)`.

### Commit phase (pointerUp)
1. If `_path.length < 3`: clear scratch, call `ctx.clearSelection()`, return.
2. Close the polygon: implicitly — the scanline fill treats `_path` as a closed polygon.
3. Rasterize: run scanline polygon fill on `_path` to produce a `Uint8ClampedArray` mask of size `w × h`.
4. Compute bounds from mask.
5. Call `ctx.setSelection({ data: mask, width: w, height: h, bounds })`.
6. Clear scratch.

### Scanline polygon fill algorithm
Standard even-odd scanline:
```
For each row y in [0, canvasHeight):
  Find all x intersections with the polygon edges at y + 0.5
  Sort intersections
  Fill pixels between pairs: [x0,x1], [x2,x3], ...
```
Pixel `(x, y)` is inside if the number of edge crossings to its left is odd.

### Scratch path preview
Use a small (`w × h × 4`) `Uint8ClampedArray` scratch. On each move, fill with 0, then Bresenham-plot the entire `_path` polyline in white (0xffffffff). Efficient enough for typical lasso paths (< 10K points).

## Trade-offs
- **Redraw entire path each move frame vs incremental:** redraw entire path is simpler and correct; incremental would be faster but not needed at pixel art canvas sizes (≤ 4096×4096 with << 10K path points).
- **Scanline fill vs flood fill from interior:** scanline is O(w×h) worst case but deterministic and works for any polygon including self-intersecting shapes. Flood fill from centroid can fail for concave shapes.
- **No move mode in lasso:** keeps tool surface area small. Users switch to Marquee for move operations.

## Risks
- Scanline with self-intersecting paths produces even-odd fill (standard behavior, same as Photoshop lasso). This is expected and fine.
- Very fast drags may skip canvas pixels between `onPointerMove` calls; Bresenham interpolation between consecutive path points handles this correctly.
