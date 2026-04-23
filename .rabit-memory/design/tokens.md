---
name: Design Tokens
description: Canonical color, typography, spacing, and motion tokens for RaBIT — values locked in Phase 3
type: project
---

# Design Tokens (v1.0 — 2026-04-19)

All values are canonical. No component should hard-code colors, spacing, or sizes — only reference token names. Full context in `docs/design-system.md` §3.

## Background Scale (6 levels, darkest → lightest)

| Token | Hex | Role |
|---|---|---|
| `--bg-0` | `#141414` | App window, deepest |
| `--bg-1` | `#1c1c1c` | Panel body, canvas surround |
| `--bg-2` | `#242424` | Panel header, toolbar, menu bar |
| `--bg-3` | `#2e2e2e` | Input fields, dropdown bg |
| `--bg-4` | `#383838` | Hover states |
| `--bg-5` | `#444444` | Active/pressed states |

## Text

| Token | Hex | Role |
|---|---|---|
| `--text-primary` | `#e8e8e8` | Primary labels, active values |
| `--text-secondary` | `#9a9a9a` | Captions, labels, inactive values |
| `--text-disabled` | `#5a5a5a` | Disabled controls (intentionally sub-AA) |
| `--text-inverse` | `#141414` | Text on accent/light surfaces |

## Accent (blue family — single accent, not multi-hue)

| Token | Hex | Role |
|---|---|---|
| `--accent-primary` | `#4B8EF0` | Active tool, selection, focus ring |
| `--accent-dim` | `#2A5CB3` | Accent on dark bg (active layer row) |
| `--accent-muted` | `#1E3E78` | Subtle accent tint (timeline range) |

## Semantic

| Token | Hex | Role |
|---|---|---|
| `--color-danger` | `#E05252` | Destructive actions, errors |
| `--color-danger-dim` | `#7A2020` | Danger hover, bg tint |
| `--color-warning` | `#D4903A` | Warnings |
| `--color-success` | `#52C27A` | Success states |

## Borders

| Token | Hex | Role |
|---|---|---|
| `--border-subtle` | `#2a2a2a` | Panel dividers |
| `--border-default` | `#383838` | Input borders |
| `--border-strong` | `#505050` | Focused inputs |
| `--border-accent` | `#4B8EF0` | Focus rings, selected borders |

## Canvas-Specific

| Token | Value | Role |
|---|---|---|
| `--checker-light` | `#606060` | Transparency checker, light squares |
| `--checker-dark` | `#484848` | Transparency checker, dark squares |
| `--grid-color` | `rgba(255,255,255,0.08)` | Pixel grid |
| `--selection-color` | `#FFFFFF` | Marching ants (alternated with `--bg-0`) |
| `--onion-prev` | `rgba(255,80,80,0.35)` | Onion: previous frames (red) |
| `--onion-next` | `rgba(80,140,255,0.35)` | Onion: next frames (blue) |

## Typography

- `--font-ui`: Inter, system-ui, -apple-system, sans-serif (bundled WOFF2, subset)
- `--font-mono`: JetBrains Mono, Cascadia Code, monospace (bundled WOFF2, subset)

Scale: `--text-2xs` 10px · `--text-xs` 11px · `--text-sm` 12px (default) · `--text-md` 13px · `--text-lg` 15px

UI scale multiplier: `--ui-scale` (0.9 / 1.0 / 1.25) in Preferences — do NOT add new type sizes for accessibility, scale instead.

## Spacing (4px base, 6 steps)

`--space-1` 4px · `--space-2` 8px · `--space-3` 12px · `--space-4` 16px · `--space-5` 24px · `--space-6` 32px

## Radius

`--radius-sm` 2px (inputs, small buttons) · `--radius-md` 4px (panels, dropdowns) · `--radius-lg` 6px (modals only) · `--radius-none` 0 (canvas, timeline cells)

## Shadows (high opacity — necessary against dark bg)

`--shadow-sm` `0 2px 4px rgba(0,0,0,0.5)` (tooltips) · `--shadow-md` `0 4px 12px rgba(0,0,0,0.6)` (menus) · `--shadow-lg` `0 8px 24px rgba(0,0,0,0.7)` (modals)

## Motion

`--duration-fast` 80ms · `--duration-default` 150ms · `--duration-slow` 250ms · `--easing-default` `cubic-bezier(0.2, 0, 0, 1)` (fast-in, eased-out)

**Rule:** only animate when the animation communicates state change. No decorative micro-animations.

## Load-bearing rationale

- **Blue accent (not orange/purple):** consistent with pro-tool convention (VS Code, Figma, Blender); orange conflicts with warning semantics.
- **6 bg levels (not 3–4):** RaBIT has genuinely nested surfaces (app → panel → header → input → input:hover → input:active). Each level maps to exactly one role.
- **Minimal rounding (2–6px):** professional tools look sharp, not rounded.
- **Bundled fonts (not system):** guarantees identical rendering across Windows/macOS/Linux WebViews. Subset to used glyphs to minimize binary size.

**How to apply:** If asked to add a new color/size token, first verify an existing token doesn't serve the role. Token additions require a design-system.md update and recompile of the contrast audit.
