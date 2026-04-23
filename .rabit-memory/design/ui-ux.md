---
name: UI/UX Specification
description: Layout structure, panel system, and interaction model for RaBIT — approved Phase 3 output
type: project
---

# UI/UX Specification (v1.0 — 2026-04-19)

Full spec lives in `docs/design-system.md`. This file captures load-bearing decisions for future sessions.

## Layout Anatomy (locked)

- **Menu Bar** (top, 28px): File · Edit · View · Layer · Frame · Sprite · Help
- **Tool Bar** (left, 48px fixed, Tab-collapsible): drawing · selection (P1 dimmed) · view tools
- **Canvas Viewport** (center, fills remaining space)
- **Right Panel Stack** (right, 240px default, 180–360px, Tab-collapsible): Layers · Color · Palette · Properties
- **Tool Options Bar** (below canvas, 32px, context-sensitive)
- **Timeline** (bottom, 120px default, 80–240px, Tab-collapsible)

## Interaction Model

- **Tab** toggles all panels simultaneously (canvas-max mode, Blender-style)
- **Space** held = Hand tool (temporary)
- **Keyboard-first** — every mouse action has a keyboard equivalent; common ops reachable in ≤ 2 keystrokes with no modifier
- Single-letter tool shortcuts: B (pencil), E (eraser), G (fill/pour), L (line), I (eyedropper), H (hand), Z (zoom), X (swap colors), D (reset colors)
- `,` / `.` for prev/next frame · `Enter` play/pause
- Shortcuts are user-remappable (Preferences → Keyboard)

## Component Inventory (for Phase 7)

Primitives: Button (primary/secondary/ghost/danger) · Input (with drag-scrub on number inputs) · Slider · Checkbox · Toggle · Dropdown (custom, not native `<select>`)

Composites: Panel (header + collapsible body) · ContextMenu · Tooltip · ModalDialog · ProgressBar

Specialized: LayerPanel · ColorPickerPanel (HSV/RGB/Hex tabs) · PalettePanel · Timeline · ToolBar · ToolOptionsBar

## Key Design Decisions (with rationale)

- **Custom dropdown, not native `<select>`** — native `<select>` breaks dark theme consistency across OSes and can't match keyboard behavior we want (type-to-filter on >10 items).
- **CSS Modules + CSS custom properties** — no CSS-in-JS. Reason: Vite is faster at build, no runtime style injection latency. Design tokens live in `src/styles/tokens.css`.
- **Canvas element must be DOM sibling (not child) of panel layout** — panel resize would otherwise trigger canvas reflow.
- **Virtualize layer list and frame grid when >50 items** — react-window or custom windowed renderer.
- **Drag-scrub on number inputs** (Blender pattern) — pointer-lock + delta accumulation. Faster than typing for tweaking values.
- **Tool Options Bar transitions instantly** (no fade) on tool change — speed over polish for frequent action.

## Accessibility Baseline

- WCAG 2.1 AA contrast on all interactive text (verified in design-system.md §10)
- `:focus-visible` outlines (2px accent) on every interactive element
- No color-only signaling — shape/icon/text always accompanies color
- Canvas screen-reader support explicitly out of scope for v1 (inherently visual); panel UI is accessible

## Out of Scope for v1

- Light theme (dark-only)
- Mobile/tablet (desktop ≥ 1280×720 only)
- Canvas screen-reader support
- Multi-window/multi-monitor workspace layouts
- Custom panel docking (panels only stack in fixed zones)

**Why:** Every "maybe later" item here was a deliberate cut to keep MVP scope tight. Revisiting should require explicit PRD update.

**How to apply:** If a future task asks for any of these, flag the scope drift before implementing.
