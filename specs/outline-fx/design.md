# Outline Layer Effect — Design

## Approach
Implement `outlineLayer()` as a new action-composer function. It reads the active layer buffer, scans for transparent pixels adjacent (4-directional) to opaque pixels, builds a `PixelDelta[]` list, and executes a single `DrawCommand`. The outline color defaults to the current primary color from `usePaletteStore` / `useToolStore`.

## Affected components

| File | Change |
|---|---|
| `src/state/action-composers/layerFxActions.ts` | New file — `outlineLayer()` function |
| `src/state/action-composers/index.ts` | Export `layerFxActions` |
| `src/ui/menu/EditMenu.tsx` | Add "Outline Layer" menu item |

## Data model changes
None — uses existing `DrawCommand` and layer buffer infrastructure.

## Key flow

```
outlineLayer():
  layerId = useLayerStore.activeLayerId
  if locked → return
  buf = resolveCell(frames, activeFrameIndex, layerId)
  w, h = canvas.width, canvas.height
  primaryColor = useToolStore.getPrimaryColor()  // or usePaletteStore primary

  deltas: PixelDelta[] = []
  for y in [0, h):
    for x in [0, w):
      if alpha(buf[x,y]) > 0: continue          // already opaque → skip
      neighbors = [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]
      if any neighbor is opaque:
        deltas.push({ x, y, before: readPixel(buf,x,y,w), after: primaryColor })

  if deltas.length === 0: return
  cmd = new DrawCommand(layerId, deltas, buf, w, notifyChanged, 'Outline layer')
  useHistoryStore.execute(cmd)
```

## Trade-offs
- **Primary color as outline color:** matches the workflow in Aseprite where the foreground color is used. No modal dialog required.
- **4-directional only:** diagonal outlines are rare in pixel art and would produce much thicker outlines for diagonal edges. 4-dir is the correct default.
- **Single DrawCommand:** all outline pixels in one undo entry, which is the expected behavior.

## Risks
- Very large canvases with many opaque pixels could produce large `PixelDelta[]` arrays. For a 512×512 fully-painted layer the perimeter could be ~2K pixels at most — well within the memory budget.
