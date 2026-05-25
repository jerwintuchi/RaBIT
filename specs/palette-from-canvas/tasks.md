# Color Count + Palette from Canvas — Tasks

- [ ] **Task 1** — Add `buildFromCanvas` action
  - Files: `src/state/action-composers/paletteActions.ts` (new)
  - Collect unique non-transparent colors from all visible layers of active frame
  - `mode: 'replace' | 'append'`; replace clears existing swatches first
  - Check: compiles, no TS errors

- [ ] **Task 2** — Export from action-composers index
  - Files: `src/state/action-composers/index.ts`
  - Export `paletteActions`
  - Check: typecheck passes

- [ ] **Task 3** — Color count display in `PalettePanel`
  - Files: `src/ui/panels/PalettePanel/PalettePanel.tsx`
  - Add `useMemo` that scans visible layers and returns unique color count
  - Display count in panel header: `"N colors"`
  - Subscribe to `useLayerStore` data versions so count updates on paint/undo
  - Check: count changes when painting or undoing

- [ ] **Task 4** — "Build from Canvas" buttons in `PalettePanel`
  - Files: `src/ui/panels/PalettePanel/PalettePanel.tsx`
  - Add two small buttons: "Replace Palette" and "Append to Palette"
  - "Replace" shows a browser `confirm()` dialog before clearing (no external modal dependency)
  - Check: Replace clears and fills palette; Append adds only new colors; no duplicates

- [ ] **Task 5** — Build and verify
  - Run `pnpm typecheck && pnpm build && pnpm test`
  - Paint with 3 distinct colors → count shows "3 colors"
  - Click "Replace Palette" → palette shows exactly those 3 swatches
  - Click "Append to Palette" after adding a 4th color → palette grows by 1 swatch
