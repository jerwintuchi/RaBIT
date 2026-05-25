# Color Count + Palette from Canvas — Design

## Approach
Two independent additions:

1. **Color count:** a `useMemo` in `PalettePanel` that scans the active frame's composite pixel buffer for unique non-transparent RGBA values. Displayed as a small counter in the panel header. Recomputes when layer data versions change.

2. **Build from canvas:** a button in `PalettePanel` that calls an action-composer function `paletteActions.buildFromCanvas(mode: 'replace' | 'append')`. The function composites all visible layers of the active frame into a single buffer (or reads each layer individually), collects unique colors, and calls `usePaletteStore.getState().setSwatches(...)`.

## Affected components

| File | Change |
|---|---|
| `src/state/action-composers/paletteActions.ts` | New file — `buildFromCanvas(mode)` |
| `src/state/action-composers/index.ts` | Export `paletteActions` |
| `src/ui/panels/PalettePanel/PalettePanel.tsx` | Add color count display + "Build from Canvas" buttons |

## Data model changes
None — uses existing `Swatch` / `Palette` types and `usePaletteStore`.

## Key flow

### Color count (PalettePanel)
```tsx
const colorCount = useMemo(() => {
  // Read all visible layers for the active frame, collect unique non-transparent colors
  const seen = new Set<number>();
  for (const layer of layers) {
    if (!layer.visible) continue;
    const buf = resolveCell(frames, activeFrameIndex, layer.id);
    if (!buf) continue;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3]! === 0) continue;
      const rgba = (buf[i]! << 24 | buf[i+1]! << 16 | buf[i+2]! << 8 | buf[i+3]!) >>> 0;
      seen.add(rgba);
    }
  }
  return seen.size;
}, [layers, frames, activeFrameIndex, dataVersionKey]);
```
`dataVersionKey` is derived from `useLayerStore` data versions so the memo re-runs on every paint.

### buildFromCanvas(mode)
```
collect all unique non-transparent RGBA values across visible layers (same loop as above)
convert each to a Swatch: { id: nanoid(), r, g, b, a, name: '' }
if mode === 'replace': usePaletteStore.getState().setSwatches(newSwatches)
if mode === 'append': usePaletteStore.getState().addSwatches(newSwatches filtered by not-already-present)
```

## Trade-offs
- **useMemo in panel vs dedicated store selector:** keeps color count as a derived value without adding it to the store. Recalculates when any relevant dependency changes. Performance is O(pixels × layers) but runs only in the palette panel component, not on every tool event.
- **No palette undo for build:** palette operations don't currently go through the command system. A confirmation dialog for "Replace" mode prevents accidental loss.
- **Composite vs per-layer scan:** scanning per-layer is simpler and correct; compositing would merge blended colors which is not what artists want for palette extraction.

## Risks
- Large canvases (4096×4096) with many layers could make the color count memo slow. Mitigate by only scanning visible layers and by debouncing if needed.
