# Indexed Color Mode — Design

## Approach
Indexed mode is a **paint-time constraint**: the color used for any draw operation is snapped to the nearest palette swatch before pixels are written. Internally all data stays RGBA32 — no format change. The snapping happens in `ToolEngineContext.snapColorIfIndexed(color)`, which each drawing tool calls at stroke-start. The palette panel gets a toggle button. The color well gets a warning dot. The Edit menu gets a "Quantize to palette" action backed by a new command.

## Affected Components

| File | Change |
|---|---|
| `src/core/DataModel/colorConversion.ts` | Add `nearestSwatchColor(color: RGBA, swatches: Swatch[]): RGBA` |
| `src/core/ToolEngine/types.ts` | Add `snapColorIfIndexed(color: RGBA): RGBA` to `ToolEngineContext` |
| `src/state/toolBridge.ts` | Implement `snapColorIfIndexed` reading `usePaletteStore` |
| `src/state/usePaletteStore.ts` | Add `indexedMode: boolean`, `setIndexedMode(v: boolean): void` |
| `src/core/tools/PencilTool.ts` | Call `ctx.snapColorIfIndexed(color)` in `resolvePaintColor()` |
| `src/core/tools/EraserTool.ts` | No change (eraser paints transparent — snap irrelevant) |
| `src/core/tools/FillTool.ts` | Snap fill color before flood-fill |
| `src/core/tools/LineTool.ts` | Snap draw color at stroke-start |
| `src/core/tools/RectangleTool.ts` | Snap draw color at stroke-start |
| `src/core/tools/EllipseTool.ts` | Snap draw color at stroke-start |
| `src/core/commands/PaletteCommands.ts` | Add `QuantizeToPaletteCommand` |
| `src/state/action-composers/index.ts` | Export `quantizeToPalette()` action |
| `src/ui/panels/ColorPickerPanel/ColorWells.tsx` | Show warning indicator when primary ≠ any swatch in indexed mode |
| `src/ui/panels/PalettePanel/PalettePanel.tsx` | Add indexed mode toggle button to header |
| `src/ui/menu/EditMenu.tsx` | Add "Quantize to palette" menu item |

## Data Model Changes
`usePaletteStore` gains `indexedMode: boolean` (default `false`). No changes to the persistent `Palette` or `Project` types — indexed mode is a session/tool preference, not project data.

## Key Flows

### Color snapping
```ts
// In toolBridge.ts
snapColorIfIndexed(color: RGBA): RGBA {
  const { indexedMode, palette } = usePaletteStore.getState();
  if (!indexedMode || palette.swatches.length === 0) return color;
  return nearestSwatchColor(color, palette.swatches);
}
```

### Nearest swatch algorithm
Euclidean distance in RGB space (alpha is ignored — transparent eraser strokes bypass snapping):
```ts
function nearestSwatchColor(color: RGBA, swatches: Swatch[]): RGBA {
  const r0 = (color >>> 24) & 0xff;
  const g0 = (color >>> 16) & 0xff;
  const b0 = (color >>> 8)  & 0xff;
  let best = swatches[0]!.color;
  let bestDist = Infinity;
  for (const sw of swatches) {
    const r = (sw.color >>> 24) & 0xff;
    const g = (sw.color >>> 16) & 0xff;
    const b = (sw.color >>> 8)  & 0xff;
    const d = (r-r0)**2 + (g-g0)**2 + (b-b0)**2;
    if (d < bestDist) { bestDist = d; best = sw.color; }
  }
  return best;
}
```

### QuantizeToPaletteCommand
Iterates every pixel in the active layer's active frame cell, snaps each to the nearest swatch, stores before/after as a `DrawCommand`-style delta list. Fully undoable. The action-composer reads the active layer and frame, builds the delta map, and dispatches the command via `useHistoryStore`.

### Warning indicator
`ColorWells.tsx` subscribes to `usePaletteStore`. When `indexedMode` is true and `primaryColor` has no exact match in `palette.swatches`, a small yellow `⚠` dot is rendered overlaid on the primary color well.

## Trade-offs
- **Snap at stroke-start, not per-pixel**: snapping once per stroke is correct because the primary color doesn't change mid-stroke.
- **Alpha preserved after snap**: snapping to nearest swatch only replaces RGB; alpha stays at the painted value. This means semi-transparent strokes still work in indexed mode — intentional.
- **No re-quantize on palette change**: auto-requantizing all pixels when a swatch is edited would be destructive and surprising. User must invoke the command explicitly.

## Risks
- If the palette is empty and indexed mode is on, snapping should be a no-op. `nearestSwatchColor` returns the original color when `swatches.length === 0`.
