# M7 — Color + Palette Panels

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete

## What was built
- ColorPickerPanel in `src/ui/panels/ColorPickerPanel/ColorPickerPanel.tsx`
- HSV, RGB, Hex picker tabs (HsvPicker, RgbPicker, HexPicker) — all three modes stay in sync
- ColorWells with primary/secondary + swap in `src/ui/panels/ColorPickerPanel/ColorWells.tsx`
- ColorHistory in `src/ui/panels/ColorPickerPanel/ColorHistory.tsx`
- PalettePanel in `src/ui/panels/PalettePanel/PalettePanel.tsx`
- Palette import (GPL, hex, CSV) in `src/core/DataModel/paletteImport.ts`
- PaletteCommands in `src/core/commands/PaletteCommands.ts` — all palette edits are undoable
- Hex input accepts 6-char and 8-char values

## Reference
- `docs/design-system.md` §color-picker — visual and interaction spec
- `docs/PRD.md` §color-system — palette requirements
