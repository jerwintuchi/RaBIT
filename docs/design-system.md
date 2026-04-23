# RaBIT — UI/UX Design System
**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Approved for Implementation Phase

---

## 1. Design Philosophy

RaBIT's UI is a **professional tool, not a consumer app.** The design references Blender, Figma, and Adobe applications — dense, dark, information-rich, and keyboard-driven. Every element earns its space.

Three non-negotiable principles:

1. **The canvas is primary.** Everything else — panels, toolbars, timeline — is secondary. The canvas gets as much screen real estate as the user allows, and every chrome element should recede visually.
2. **Keyboard-first.** Any operation reachable by mouse must also be reachable by keyboard. Common operations must be reachable in ≤ 2 keystrokes with no modifier. Shortcut hints appear on every actionable element.
3. **No decorative elements.** No gradients that don't encode information, no drop shadows that don't encode elevation, no icons that don't have a tooltip. If it doesn't communicate something, it shouldn't be there.

---

## 2. Application Layout

### 2.1 Window Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  Title Bar (native OS — minimal, shows "filename.rabit · RaBIT")     │
├──────────────────────────────────────────────────────────────────────┤
│  Menu Bar: File  Edit  View  Layer  Frame  Sprite  Help              │
├──────┬───────────────────────────────────────────┬───────────────────┤
│      │                                           │                   │
│ Tool │              Canvas Viewport              │   Right Panel     │
│  Bar │         (fills remaining space)           │   Stack           │
│      │                                           │                   │
│      │                                           │   [Layers]        │
│      │                                           │   [Color]         │
│      │                                           │   [Palette]       │
│      │                                           │   [Properties]    │
│      │                                           │                   │
├──────┴───────────────────────────────────────────┴───────────────────┤
│  Tool Options Bar (context-sensitive, below canvas)                  │
├──────────────────────────────────────────────────────────────────────┤
│  Timeline / Frame Strip                                              │
│  [◀ ▶ ▶|  ● ] [ fr1 | fr2 | fr3 | fr4 | ... ]  fps: [12]           │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layout Zones

| Zone | Width / Height | Resizable | Collapsible |
|---|---|---|---|
| Menu Bar | 100% width, 28px | No | No |
| Tool Bar | 48px wide, full height | No | Yes (Tab key) |
| Canvas Viewport | Remaining space | Fills automatically | No |
| Right Panel Stack | 240px default, 180–360px range | Yes (drag divider) | Yes (Tab key) |
| Tool Options Bar | 100% width, 32px | No | No |
| Timeline | 100% width, 120px default, 80–240px range | Yes (drag divider) | Yes (Tab key) |

**Collapse behavior:** Pressing `Tab` hides/shows all panels simultaneously (canvas-maximized mode, like Blender fullscreen). Individual panel headers have a collapse chevron.

### 2.3 Right Panel Stack

Panels stack vertically in the right rail. Each panel has a header (label + collapse chevron). The stack scrolls if panels exceed window height. Users can drag panel headers to reorder them.

Default panel order (top to bottom):
1. **Layers** — layer list, add/delete/reorder/blend mode
2. **Color** — HSV/RGB/Hex picker, primary + secondary color wells
3. **Palette** — named color swatches grid
4. **Properties** — canvas size, frame duration, layer settings (context-sensitive)

### 2.4 Canvas Viewport

The canvas viewport has three visual layers (back to front):
1. Checkerboard pattern — indicates transparency (configurable color)
2. Canvas pixels (GPU-composited layers)
3. Overlays: grid, selection marquee, cursor preview

**Viewport chrome:**
- Zoom level display (bottom-left, click to enter specific value)
- Canvas coordinates under cursor (bottom-center, `x: 42, y: 17`)
- Color under cursor (bottom-right, shows RGBA hex)

---

## 3. Design Tokens

### 3.1 Color System

All colors are defined as CSS custom properties on `:root`. The dark theme is the only shipped theme in v1.

#### Background Levels

Dark UIs avoid a flat background — depth is communicated through a stack of surface levels. Lower number = darker = further back.

| Token | Value | Usage |
|---|---|---|
| `--bg-0` | `#141414` | App window background, deepest level |
| `--bg-1` | `#1c1c1c` | Panel bodies, canvas surround |
| `--bg-2` | `#242424` | Panel headers, toolbar, menu bar |
| `--bg-3` | `#2e2e2e` | Input fields, dropdown backgrounds |
| `--bg-4` | `#383838` | Hover states on interactive elements |
| `--bg-5` | `#444444` | Active/pressed states |

**Tradeoff note:** Using 6 levels risks over-complicating depth. The rationale for 6 (vs 3–4 used by some tools) is that RaBIT has genuinely nested surfaces: app bg → panel bg → panel header → input → input:hover → input:active. Each level maps to exactly one role, so the system doesn't require judgment calls during implementation.

#### Text Colors

| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `#e8e8e8` | Primary labels, active values |
| `--text-secondary` | `#9a9a9a` | Labels, captions, inactive values |
| `--text-disabled` | `#5a5a5a` | Disabled controls |
| `--text-inverse` | `#141414` | Text on light/accent surfaces |

#### Accent Colors

A single accent color family. Blue was chosen over orange/purple because:
- Blue reads as "selected/active" across all major professional tools (VS Code, Figma, Blender)
- Orange conflicts with warning semantics
- High contrast against the near-black backgrounds

| Token | Value | Usage |
|---|---|---|
| `--accent-primary` | `#4B8EF0` | Active tool, selected item highlight, focus ring |
| `--accent-dim` | `#2A5CB3` | Accent on dark bg (e.g., active layer row) |
| `--accent-muted` | `#1E3E78` | Subtle accent tint (e.g., selection range in timeline) |

#### Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `--color-danger` | `#E05252` | Destructive actions, error states |
| `--color-danger-dim` | `#7A2020` | Danger hover, danger bg tint |
| `--color-warning` | `#D4903A` | Warnings (e.g., large undo stack) |
| `--color-success` | `#52C27A` | Success states (export complete, save success) |

#### Border Colors

| Token | Value | Usage |
|---|---|---|
| `--border-subtle` | `#2a2a2a` | Panel dividers, very subtle separation |
| `--border-default` | `#383838` | Input borders, panel edges |
| `--border-strong` | `#505050` | Focused inputs, active panel borders |
| `--border-accent` | `#4B8EF0` | Focus rings, selected item borders |

#### Canvas-Specific Colors

| Token | Value | Usage |
|---|---|---|
| `--checker-light` | `#606060` | Transparency checkerboard (light squares) |
| `--checker-dark` | `#484848` | Transparency checkerboard (dark squares) |
| `--grid-color` | `rgba(255,255,255,0.08)` | Pixel grid lines |
| `--selection-color` | `#FFFFFF` | Marching ants (alternated with `--bg-0`) |
| `--onion-prev` | `rgba(255, 80, 80, 0.35)` | Previous frames (red tint) |
| `--onion-next` | `rgba(80, 140, 255, 0.35)` | Next frames (blue tint) |

### 3.2 Typography

#### Font Families

```css
--font-ui:    'Inter', system-ui, -apple-system, sans-serif;
--font-mono:  'JetBrains Mono', 'Cascadia Code', monospace;
```

**Inter** for UI text — compact, highly legible at 11–13px, designed for dense interfaces.  
**JetBrains Mono** for all numeric values, hex codes, coordinate displays, and code-adjacent content. Monospace ensures digits align vertically.

Both fonts are bundled in the app build (WOFF2, subset to used glyphs) to guarantee consistent rendering across OSes.

#### Type Scale

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `--text-2xs` | 10px | 1.4 | 400 | Micro labels (pixel coordinates, swatches) |
| `--text-xs` | 11px | 1.4 | 400 | Panel section labels, tooltips |
| `--text-sm` | 12px | 1.5 | 400 | Default UI text, inputs, menu items |
| `--text-md` | 13px | 1.5 | 500 | Panel headers, section titles |
| `--text-lg` | 15px | 1.4 | 600 | Dialog titles |

No sizes below 10px. No sizes above 15px in the main UI — this is a tool, not a landing page.

**Tradeoff:** 11–13px feels cramped for non-tool-users. For professional tools (Blender runs at 12px by default, Figma at 12px), this is the correct density. We expose a `--ui-scale` multiplier (0.9x, 1.0x, 1.25x) in preferences to accommodate high-DPI and accessibility needs without maintaining a second type scale.

### 3.3 Spacing Scale

Based on a 4px base unit. No values outside this scale should appear in CSS.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight padding inside compact controls |
| `--space-2` | 8px | Default inner padding for inputs, buttons |
| `--space-3` | 12px | Section gaps within panels |
| `--space-4` | 16px | Panel padding, dialog content padding |
| `--space-5` | 24px | Between major sections in dialogs |
| `--space-6` | 32px | Generous gaps (rare — dialog margins) |

### 3.4 Border Radius

RaBIT uses minimal rounding. Professional tools look sharp, not rounded.

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 2px | Inputs, small buttons, swatches |
| `--radius-md` | 4px | Panels, dialogs, dropdowns |
| `--radius-lg` | 6px | Modal dialogs only |
| `--radius-none` | 0px | Canvas, timeline cells |

### 3.5 Icon System

Icons use a custom SVG icon set. Requirements:
- 16×16 viewBox, 1px stroke, rounded joins
- All icons export as React components via SVGR (`src/assets/icons/`)
- `currentColor` fill/stroke — inherits from CSS `color` property
- Two sizes in use: 16px (toolbar, panel headers) and 12px (inline labels, menu items)

Icon naming convention: `Icon{Name}` — e.g., `IconPencil`, `IconEraser`, `IconLayer`, `IconTrash`.

### 3.6 Shadows / Elevation

Shadows are used sparingly — only for floating elements (dropdowns, tooltips, dialogs).

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 2px 4px rgba(0,0,0,0.5)` | Tooltips, small dropdowns |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.6)` | Context menus, panel popovers |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.7)` | Modal dialogs |

High opacity shadows (0.5–0.7) are necessary against dark backgrounds — light shadows disappear.

### 3.7 Motion & Timing

RaBIT is a tool — animation should be functional, not decorative. The rule: **only animate when the animation communicates state change.**

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | 80ms | Hover states, button presses |
| `--duration-default` | 150ms | Panel collapse/expand, dropdown open |
| `--duration-slow` | 250ms | Modal open/close, large layout changes |
| `--easing-default` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions (fast-in, eased-out) |

**No** spinning loaders, bouncing elements, or decorative micro-animations. Export progress uses a flat progress bar with a numeric percentage.

---

## 4. Component Library

### 4.1 Button

Three variants:

| Variant | Background | Text | Use case |
|---|---|---|---|
| `primary` | `--accent-primary` | `--text-inverse` | One clear CTA per dialog (Save, Export, Apply) |
| `secondary` | `--bg-3` | `--text-primary` | Default actions (Cancel, Close, Add Layer) |
| `ghost` | transparent | `--text-secondary` | Toolbar icon buttons, panel header actions |
| `danger` | `--color-danger` | `#fff` | Destructive confirmation (Delete, Clear Canvas) |

States: `:hover` → `--bg-4` / lighten 10%, `:active` → `--bg-5` / darken 5%, `:disabled` → 40% opacity, no pointer events, `:focus-visible` → 2px `--border-accent` outline.

Sizes:
- `sm`: height 24px, `--space-2` horizontal padding — compact toolbar controls
- `md`: height 28px (default), `--space-3` horizontal padding
- `icon`: 28×28px, no padding — square icon-only buttons

Keyboard shortcut badge: buttons can carry an inline `<kbd>` element showing the shortcut: `[Save] Ctrl+S`. The `<kbd>` uses `--font-mono`, `--text-2xs`, `--bg-2`, border `--border-default`.

### 4.2 Input

Text input and number input share the same base style.

```
border: 1px solid --border-default
background: --bg-3
height: 26px
padding: 0 --space-2
font: --text-sm --font-ui
color: --text-primary
border-radius: --radius-sm

:hover → border: --border-strong
:focus → border: --border-accent, outline: none (ring replaced by border)
:invalid → border: --color-danger
```

**Number input** has increment/decrement arrows on the right (14px wide, stacked). Alternatively, the user can drag horizontally on the label to scrub the value (Blender-style scrub). Scrubbing is implemented via `pointerdown` → lock pointer → `pointermove` → delta accumulation.

### 4.3 Slider

Used for opacity, tool size, onion skin opacity, and similar continuous values.

```
Track: --bg-1, 4px tall, --radius-sm
Fill: --accent-primary
Thumb: 12×12px circle, --accent-primary, border 2px --bg-0
:hover thumb → 14×14px
:focus thumb → --border-accent ring
```

Label + value are always shown alongside the slider (not just on hover). Value is editable by clicking the number.

### 4.4 Checkbox & Toggle

**Checkbox:** 14×14px. Unchecked: `--bg-3` fill, `--border-default` border. Checked: `--accent-primary` fill, white checkmark SVG. Indeterminate: `--accent-primary` fill, dash.

**Toggle:** Used for binary panel settings (e.g., "Show grid", "Onion skin on"). 28×16px pill. Off: `--bg-3` track, `--bg-5` thumb. On: `--accent-primary` track, white thumb. Animates thumb slide in `--duration-fast`.

Checkboxes are for settings lists. Toggles are for persistent on/off states visible in the toolbar or panel headers.

### 4.5 Dropdown / Select

A custom dropdown (not native `<select>`) to maintain dark-theme consistency and keyboard behavior.

```
Trigger: matches Input styling (height 26px, --radius-sm, chevron icon right)
Dropdown panel: --bg-2, --radius-md, --shadow-md, min-width = trigger width
Option row: height 26px, --space-2 horizontal padding
  :hover → background --bg-4
  :active → background --bg-5
  selected → background --accent-muted, text --text-primary
```

Keyboard: Arrow keys navigate, Enter selects, Escape closes. Type to filter (shows subset of options) when list > 10 items.

### 4.6 Panel

A panel is the fundamental right-rail building block.

```
Panel
├── PanelHeader (height 28px, --bg-2, flex row, click to toggle collapse)
│   ├── ChevronIcon (rotates 90° when expanded, --duration-fast)
│   ├── Label (--text-md, --text-primary)
│   └── Actions slot (icon buttons, shown on header hover)
└── PanelBody (--bg-1, padding --space-3, overflow-y scroll)
    └── [content]
```

Collapsed state: PanelBody has `height: 0; overflow: hidden` with transition `--duration-default`.

### 4.7 Context Menu

Appears on right-click (canvas, layers, timeline cells).

```
Container: --bg-2, --radius-md, --shadow-lg, min-width 180px, z-index 1000
Item: height 26px, padding 0 --space-3, --text-sm
  :hover → --bg-4
  .separator → 1px --border-subtle, margin --space-1 0
  .disabled → --text-disabled, no hover
  .danger → --color-danger text
  .shortcut → float right, --text-secondary, --font-mono
```

A submenu arrow `▶` is shown for items with children. Submenu opens on hover with a 100ms delay (avoids accidental triggers).

### 4.8 Tooltip

Appears after 500ms hover on any interactive element that lacks a visible label.

```
Background: --bg-0, border 1px --border-default, --shadow-sm
Padding: --space-1 --space-2
Font: --text-xs --font-ui
Max width: 240px
Shortcut inline: [Action name]   Ctrl+Z  ← --font-mono, --text-secondary
```

Tooltips are never shown on elements with visible text labels (redundant).

### 4.9 Modal Dialog

Used for: Export settings, New canvas, Preferences, Keyboard shortcuts, Crash recovery.

```
Overlay: rgba(0,0,0,0.65), covers full viewport
Dialog: --bg-2, --radius-lg, --shadow-lg
  max-width: 480px (small), 640px (large)
  min-width: 320px
Header: 20px padding, border-bottom --border-subtle
  Title: --text-lg
  Close button: ghost, top-right
Body: 20px padding, max-height 70vh, overflow-y auto
Footer: 16px padding, border-top --border-subtle, flex row justify-end, gap --space-2
```

Dialogs trap focus (first focusable element auto-focused on open). Escape closes. Outside-click closes only for informational dialogs, not for destructive-confirmation dialogs.

### 4.10 Progress Bar

Used for export operations.

```
Track: --bg-3, height 4px, --radius-sm
Fill: --accent-primary, transitions width smoothly
Above bar: label text, --text-sm ("Exporting spritesheet...")
Right of bar: percentage, --font-mono, --text-secondary ("74%")
```

Export progress panel appears as a non-blocking bar at the bottom of the right panel stack. The user can continue working during export.

---

## 5. Toolbar Design

### 5.1 Tool Bar (Vertical Left Rail)

48px wide. Tool icons are 28×28px ghost buttons stacked vertically with 4px gaps.

**Tool groups** are separated by a 1px `--border-subtle` horizontal divider:

```
Group 1 — Drawing tools
  Pencil        (B)
  Eraser        (E)
  Line          (L)
  Fill          (G)

Group 2 — Selection tools (P1 — disabled in MVP, shown as dimmed)
  Marquee       (M)
  Lasso         (F)
  Magic Wand    (W)

Group 3 — View tools
  Pan / Hand    (H)  ← hold Space to temporarily activate
  Zoom          (Z)
  Eyedropper    (I)
```

Active tool: `--accent-dim` background, `--accent-primary` border-left 2px.  
Hover: `--bg-4` background.  
Disabled (P1 tools in MVP): 30% opacity, cursor `not-allowed`.

Tool icon has a tooltip with tool name + shortcut.

### 5.2 Tool Options Bar

Below the canvas, 32px tall, `--bg-2` background. Shows options for the currently active tool. Transitions instantly on tool change (no animation — speed matters here).

Examples:

**Pencil active:**
```
Size: [spinner 1–100]  Opacity: [slider 1–100%]  ○ Pixel perfect  ○ Anti-alias (disabled—pixel art)
```

**Eraser active:**
```
Size: [spinner 1–100]  Mode: [dropdown: Hard | Soft]
```

**Fill active:**
```
Tolerance: [spinner 0–255]  ○ Contiguous  ○ All layers
```

---

## 6. Specialized UI Components

### 6.1 Layer Panel

```
LayerPanel
├── Header: "Layers" + [+ Add] [⋮ Options]
├── Layer List (scrollable, virtualized for >100 layers)
│   └── LayerRow (height 32px)
│       ├── Visibility toggle (eye icon, toggles layer.visible)
│       ├── Lock toggle (lock icon, toggles layer.locked)
│       ├── Thumbnail (24×24px, live-rendered)
│       ├── Name (inline edit on double-click)
│       └── Drag handle (reorder)
└── Footer: blend mode [dropdown] + opacity [slider 0–100%]
```

Active layer row: `--accent-muted` background.  
Layer rows support multi-select (Shift+click, Ctrl+click).  
Drag-to-reorder uses a drag ghost + drop indicator line.

### 6.2 Color Picker Panel

Two sections: **Color Wells** (always visible) + **Picker** (collapsible).

**Color Wells:**
- Primary swatch (foreground): 32×32px
- Secondary swatch (background): 28×28px, offset down-right
- Swap button (→↓ icon, shortcut `X`)
- Reset to black/white button

**Picker (expanded):**
```
Mode tabs: [HSV] [RGB] [Hex]

HSV mode:
  Saturation/Value square (gradient, 160×160px)
  Hue bar (full spectrum, 160×12px)
  A (alpha) bar (checkerboard bg, 160×12px)
  H: [0–360] S: [0–100] V: [0–100] A: [0–100]

RGB mode:
  R: [slider 0–255]  [input]
  G: [slider 0–255]  [input]
  B: [slider 0–255]  [input]
  A: [slider 0–255]  [input]

Hex mode:
  # [RRGGBBAA input]
```

Hex input accepts 6-char (RRGGBB, alpha=FF) or 8-char (RRGGBBAA) values.

### 6.3 Palette Panel

```
PalettePanel
├── Header: "Palette" + [Import] [Export] [+]
├── Swatch Grid (auto-fill columns, swatch size 20×20px, 2px gap)
│   └── Swatch
│       ├── Color fill
│       ├── Left-click → set as primary color
│       ├── Right-click → context menu (Edit, Delete, Set as secondary)
│       └── Tooltip → color name + hex value
└── Footer: [swatch size: S M L] toggle
```

Empty swatch (the `+` at end of grid) opens a color picker dialog to add a new swatch.

### 6.4 Timeline / Frame Strip

```
Timeline
├── Controls Row (32px)
│   ├── [◀◀ First] [◀ Prev] [▶/⏸ Play] [▶ Next] [▶▶ Last]
│   ├── [● Record] — adds frame on draw when active
│   ├── FPS: [spinner 1–120, default 12]
│   ├── Loop: [checkbox]
│   └── Onion: [toggle] Before: [1–5] After: [0–5]
├── Layer Labels Column (fixed left, matches layer panel order)
│   └── LayerLabel (32px tall each)
└── Frame Grid (scrollable horizontally)
    └── FrameCell (32×32px per cell, per-layer per-frame)
        ├── Has content: shows mini thumbnail
        ├── Empty cell: --bg-1 with dotted border
        ├── Linked cell: chain-link icon
        └── Active column: --accent-muted highlight
```

Frame column headers show frame number + duration (ms). Double-click duration to edit.

Drag to select a range of frames. Right-click → context menu (Insert frame, Delete, Duplicate, Reverse, Set tag).

### 6.5 Keyboard Shortcut System

All shortcuts are displayed in a reference panel (`?` or `Ctrl+/` to open). Organized by category:

```
Category: Canvas
  B          Pencil
  E          Eraser
  G          Fill (flood fill — mnemonic: "pour")
  L          Line
  I          Eyedropper
  H          Hand / Pan
  Z          Zoom
  X          Swap colors
  D          Reset to default colors (black/white)

Category: View
  Ctrl + +   Zoom in
  Ctrl + -   Zoom out
  Ctrl + 0   Fit canvas to window
  Num 1      100% zoom
  Space      Hold for Hand tool
  Tab        Toggle panels

Category: History
  Ctrl + Z   Undo
  Ctrl + Y   Redo
  Ctrl + Shift + Z  Redo (alternate)

Category: Layers
  Ctrl + Shift + N  New layer
  Ctrl + Shift + D  Duplicate layer
  Del (on layer)    Delete layer
  Alt + [    Select layer below
  Alt + ]    Select layer above

Category: Frames
  ,          Previous frame
  .          Next frame
  Enter      Play/Pause
  Ctrl + Alt + N  New frame
  Ctrl + Alt + D  Duplicate frame

Category: File
  Ctrl + N   New project
  Ctrl + O   Open project
  Ctrl + S   Save
  Ctrl + Shift + S  Save As
  Ctrl + E   Export

Category: Selection (P1 — greyed out in MVP)
  M          Marquee select
  Ctrl + A   Select all
  Ctrl + D   Deselect
  Ctrl + I   Invert selection
```

Shortcuts are user-remappable via Preferences → Keyboard. Conflicts are detected and highlighted.

---

## 7. Canvas Cursor Design

The cursor communicates the active tool. Custom cursors are 32×32px PNG (2x for HiDPI). Hotspot is at the active point.

| Tool | Cursor | Hotspot |
|---|---|---|
| Pencil | Crosshair (+), 1px arms | Center |
| Eraser | Square outline, matches eraser size | Center |
| Fill | Fill bucket icon | Tip of spout |
| Line | Crosshair (+) | Center |
| Eyedropper | Dropper icon | Tip |
| Hand (pan) | Open hand (idle) / Closed hand (dragging) | Center |
| Zoom | Magnifier + (zoom in) / Magnifier - (zoom out) | Center |
| Zoom (Alt) | Magnifier - | Center |

When the cursor is over a locked layer, overlay a lock indicator near the cursor (but do not change the cursor itself — the locked layer indicator in the panel is the primary signal).

---

## 8. Empty States

Empty states appear in panels that have no content yet.

| Panel / State | Message | Action |
|---|---|---|
| New project, Layers panel (1 layer) | — (Layer "Layer 1" exists by default) | — |
| Palette panel, no swatches | "No palette colors. Click + to add." | `+` button |
| History (no operations yet) | "No history yet." | — |
| Timeline (1 frame) | — (single frame cell shown) | — |

Empty states use `--text-secondary`, `--text-sm`, centered in the panel body.

---

## 9. Error & Warning States

### In-UI Notifications

A notification bar appears at the bottom of the window (above the timeline) for non-blocking messages. Auto-dismisses after 4 seconds. Manual dismiss via `×`.

```
Info:    --bg-2 bg, --accent-primary left border, --text-primary text
Warning: --bg-2 bg, --color-warning left border
Error:   --bg-2 bg, --color-danger left border
```

Example messages:
- `"Autosaved — 2:34 PM"` (Info, auto-dismiss)
- `"Undo operation is large (45MB delta). History entry preserved but future entries may be trimmed."` (Warning)
- `"Export failed: output path is read-only."` (Error, no auto-dismiss)

### Crash Recovery Dialog

On startup, if a newer auto-save exists than the last save:

```
Title: "Unsaved changes recovered"
Body:  "RaBIT found an auto-save from [2 hours ago] for '[project-name.rabit]'.
        This may contain work that wasn't saved when the app closed."
Actions:
  [Restore auto-save]  [Discard and open original]  [Cancel]
```

---

## 10. Accessibility Baseline

RaBIT targets WCAG 2.1 AA for all interactive elements. Minimum contrast ratios:

- `--text-primary` (#e8e8e8) on `--bg-2` (#242424): contrast ratio **11.2:1** (passes AAA)
- `--text-secondary` (#9a9a9a) on `--bg-2` (#242424): contrast ratio **5.1:1** (passes AA)
- `--accent-primary` (#4B8EF0) on `--bg-2` (#242424): contrast ratio **5.2:1** (passes AA)
- `--text-disabled` (#5a5a5a) on `--bg-2` (#242424): contrast ratio **2.4:1** — intentionally below AA for disabled elements (disabled = not actionable, reduced contrast is the signal)

All interactive elements have visible `:focus-visible` outlines (2px `--border-accent`). No reliance on color alone to communicate state — shape, icon, or text always accompanies color.

**Not targeted in v1:** screen reader support for the canvas. Canvas-based drawing tools are inherently visual. The panel UI (layers, palettes, timeline controls) will be fully accessible.

---

## 11. Responsive Behavior

RaBIT targets desktop only (minimum 1280×720). At window sizes below this:
- The right panel stack collapses (user must manually re-open)
- Timeline collapses to minimum height (80px)
- Canvas viewport minimum: 640×480px

Below 900px wide: a warning bar informs the user that the window is below the recommended size. The app remains functional but may clip panels.

No mobile or tablet support — this is explicitly out of scope in the PRD.

---

## 12. Implementation Notes for Phase 7

When implementing this design system:

1. **Define all tokens as CSS custom properties** in `src/styles/tokens.css`. No hard-coded color or spacing values anywhere in component CSS.
2. **Build components bottom-up**: tokens → primitives (Button, Input, Slider) → composites (Panel, Dropdown) → panels (LayerPanel, PalettePanel) → layout shell.
3. **Use CSS Modules** for component scoping — no global class names except token definitions and resets.
4. **No CSS-in-JS** — Vite + CSS Modules is faster at build time and avoids runtime style injection latency.
5. **Canvas and panels are separate DOM trees.** The `<canvas>` element for WebGL should be a sibling of the panel layout, not nested inside it. This avoids layout reflows from panel resizing triggering canvas size recalculations.
6. **Panel resize** is implemented via `PointerEvents` on the divider element — set `pointer-capture` to track moves outside the divider without a drag ghost.
7. **Virtualize long lists**: Layer list and Timeline frame grid must use windowed rendering (react-window or custom) when item count > 50. Do not render all rows.

---

*End of Design System v1.0*
