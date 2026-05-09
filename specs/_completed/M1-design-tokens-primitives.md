# M1 — Design Tokens + Primitive Components

> **LEGACY — Completed pre-spec-workflow. For historical reference only. Do not use for active planning or development decisions.**

## Status
✅ Complete

## What was built
- Design tokens in `src/styles/tokens.css`
- 11 primitive components in `src/ui/primitives/`: Button, Input, Slider, Checkbox, Toggle, Dropdown, Panel, ContextMenu, Tooltip, ModalDialog, ProgressBar
- Icon system with SVGR at `src/assets/icons/`
- Dev harness at `src/ui/dev/DevHarness.tsx` for visual regression
- WCAG AA contrast verified on all text/background combinations
- All components pass `:focus-visible` keyboard navigation

## Reference
- `docs/design-system.md` §4 — component primitives spec
- `docs/design-system.md` §2 — design tokens
