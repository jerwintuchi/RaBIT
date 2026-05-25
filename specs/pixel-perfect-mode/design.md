# Pixel-Perfect Drawing Mode — Design

## Approach
Extend `BrushTool` with an optional elbow-removal pass applied after each `paintPixel` call during a stroke. The check: if the last 3 painted pixels form an L-shape (the middle pixel shares both a row and column with the outer two), remove the middle pixel. State is stored in `useToolStore` as a boolean flag read by the tool engine context.

## Affected components

| File | Change |
|---|---|
| `src/state/useToolStore.ts` | Add `pixelPerfect: boolean` + `setPixelPerfect(v)` |
| `src/state/toolBridge.ts` | Expose `pixelPerfect` to `ToolEngineContext` via a new context method `getPixelPerfect()` |
| `src/core/ToolEngine/types.ts` | Add `getPixelPerfect(): boolean` to `ToolEngineContext` |
| `src/core/tools/BrushTool.ts` | Track last 3 painted positions; after each pixel, run elbow check and remove the elbow pixel if found |
| `src/ui/toolbar/ToolBar.tsx` | Add pixel-perfect toggle button, visible only when pencil or eraser is active |

## Data model changes
No persistent changes — `pixelPerfect` is a UI session preference, not saved to `.rabit` project.

## Key flow

### Elbow detection (per pixel painted during a stroke)
```
history: [p0, p1, p2]  (p2 = just painted, p1 = previous, p0 = before that)

isElbow = (p0.x !== p2.x) && (p0.y !== p2.y)   // outer two are diagonal
       && (p1.x === p0.x || p1.y === p0.y)      // middle shares axis with one outer
       && (p1.x === p2.x || p1.y === p2.y)      // middle shares axis with other outer

If isElbow: erase p1 from scratch + deltas
```

Concretely:
- `p1.x === p0.x && p1.y === p2.y` → horizontal-then-vertical elbow
- `p1.y === p0.y && p1.x === p2.x` → vertical-then-horizontal elbow

### Scratch + delta management
When removing p1:
1. Write transparent to scratch at p1
2. Remove p1's entry from `this.deltas` if its `before` equals the original pixel (net no-op), OR restore `before` value if the pixel existed before the stroke

## Trade-offs
- **Track only 3 points:** sufficient for elbow detection; longer history is unnecessary.
- **Remove from deltas:** ensures undo is correct — the removed pixel is not part of the DrawCommand.
- **Session-only state:** pixel-perfect preference doesn't need to round-trip through the project file; it's a tool mode like any tool setting.

## Risks
- Erasing p1 after it was plotted by `plotLine`'s intermediate steps: the scratch and delta map are both modified, so undo will correctly not include the removed pixel. Low risk.
- Pixel-perfect + mirror mode: mirror pixels must also have their elbows removed. The elbow check should run on the mirrored coordinates too. Medium risk — needs care in implementation.
