# RaBIT — Product Requirements Document
**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Approved for Architecture Phase  
**Owner:** Product / Engineering Lead

---

## 1. Executive Summary

RaBIT (Raster + Bit creation system) is a professional-grade desktop application for pixel art creation and sprite animation. It is designed to serve indie game developers and digital artists who need a studio-quality tool — not a toy or hobbyist application.

RaBIT does not aim to clone Aseprite. It competes on different grounds: a modern, professional workflow, a clean architecture built for performance, and a UI philosophy closer to Figma or Blender than to retro pixel tools.

**One-line positioning:** *"The pixel and sprite studio that game developers have actually been waiting for."*

---

## 2. Problem Statement

### 2.1 Market Landscape

| Tool | Core Strength | Core Weakness |
|---|---|---|
| Aseprite | Feature-rich, community | Retro-styled UI, complex license history, limited large canvas performance |
| Photoshop | Industry standard | Not pixel-art native, heavyweight, subscription pricing |
| Pixelorama | Open source, Godot-native | Immature, limited animation depth |
| GraphicsGale | Fast, free | Windows only, dated, unmaintained |
| Pixilart | Easy onboarding | Web-only, limited for professionals |
| LibreSprite | Free Aseprite fork | Unmaintained, falling behind |

### 2.2 Pain Points We Solve

1. **Animation timeline friction** — Existing tools treat animation as an afterthought bolted onto an image editor. Frame management, tag systems, and playback controls are clunky.
2. **Large asset management** — Working with 4K spritesheets or 100+ frame animations causes significant performance degradation in existing tools.
3. **Workflow inefficiency** — Too many clicks for common operations. Professionals burn time on repetitive UI navigation.
4. **Export pipeline is manual and brittle** — Users manually configure spritesheet packing, naming conventions, and frame ordering each export.
5. **Color management is shallow** — No real palette organization, no color space awareness, limited palette import/export.
6. **No professional project structure** — Projects are single files with no concept of assets, references, or organization.
7. **UI is not customizable** — Panel layouts are fixed, blocking efficient dual-monitor or compact workspace setups.
8. **Non-destructive editing is missing** — Mistakes often require manual undo chains; no layer effects or adjustment layers.

### 2.3 Our Differentiators

- **Modern, minimal, dark UI** — Feels like a studio tool, not a toy
- **Performance-first rendering** — WebGL2 accelerated canvas, background export pipeline
- **Smart export system** — Configurable export profiles with naming templates
- **First-class animation system** — Timeline is a primary citizen, not an afterthought
- **Keyboard-first design** — Full operation via keyboard; mouse optional for power users
- **Safe, schema-versioned file format** — Forward/backward compatible `.rabit` project files

---

## 3. Target Users

### Persona A: "The Indie Developer" (Primary)
- Solo or small-team indie game developer
- Creates all own game art (characters, tiles, UI, effects)
- Works in engines like Unity, Godot, GameMaker, or custom
- Pain: Aseprite works but feels unprofessional; Photoshop is overkill and expensive
- Needs: Fast iteration, clean spritesheet export, reliable project files
- Technical level: Intermediate; uses keyboard shortcuts, understands layers

### Persona B: "The Pixel Artist" (Secondary)
- Freelance or studio digital artist specializing in pixel art
- Delivers commissioned assets to studios or game developers
- Needs professional output quality and reproducible export settings
- Pain: Existing tools are either too simple or too complex for this use case
- Technical level: High; expects a tool that respects their expertise

### Persona C: "The Studio Art Lead" (Tertiary)
- Leads a small art team (2–8 artists) working on a single project
- Needs consistency: same tool, same export pipeline, same file format across team
- Pain: No pixel art tool has team-grade project organization
- Technical level: High; evaluates tools for team adoption

---

## 4. Product Goals

### 4.1 Primary Goals (MVP / v0.9)
1. Deliver a stable, professional pixel art canvas editor
2. Deliver a first-class frame animation system with timeline
3. Deliver a robust layer system
4. Deliver a configurable export pipeline (PNG, spritesheet)
5. Deliver a reliable, versioned project file format

### 4.2 Secondary Goals (v1.0)
1. Full selection and transform system
2. Tile/seamless mode for environment artists
3. GIF export
4. Color palette import/export (GPL, ASE, PNG palette)
5. Custom keyboard shortcut mapping

### 4.3 Aspirational Goals (v1.5+)
1. Plugin/scripting system (Lua or WASM sandbox)
2. Collaboration features (shared palettes, asset libraries)
3. Reference image layer with opacity
4. Non-destructive filter effects
5. Nine-slice preview mode
6. Multi-canvas project (scenes)

---

## 5. Feature Requirements

### 5.1 Canvas System (P0)

**FR-C-01: Pixel Canvas**
- Canvas defined by width × height in pixels (1×1 to 4096×4096)
- Default canvas sizes: 16×16, 32×32, 64×64, 128×128, 256×256, custom
- Canvas background: transparent (checkerboard), solid color, or user-defined
- Zoom: 1% – 6400%, centered on cursor
- Pan: middle-mouse drag or Space+drag
- Grid: configurable pixel grid overlay (show/hide, color, opacity)
- Pixel-perfect cursor: shows exact pixel under cursor regardless of zoom
- Snap-to-pixel enforced at all times

**FR-C-02: Canvas Navigation**
- Fit-to-view shortcut
- Center canvas shortcut
- Mini-map (toggleable) showing full canvas with viewport indicator
- Ruler overlay (pixels or custom units)

**FR-C-03: Multiple Canvas Size Handling**
- Resize canvas: expand/crop with anchor point control
- Scale image: nearest-neighbor only (pixel art preserve) or point-sample
- Crop to selection

### 5.2 Layer System (P0)

**FR-L-01: Layer Types**
- Pixel layer (raster, primary type)
- Group layer (folder, for organization)
- Reference layer (image import, non-editable, opacity only) — v1.0+

**FR-L-02: Layer Operations**
- Create, duplicate, delete, rename
- Reorder via drag-and-drop
- Visibility toggle (eye icon)
- Lock toggle (prevents edits)
- Opacity control (0–100%)
- Blend modes: Normal, Multiply, Screen, Overlay (v1.0+)

**FR-L-03: Layer Management**
- Layer panel shows thumbnail preview (live, updating)
- Select active layer by clicking
- Multi-select layers for batch operations
- Merge down / Merge visible / Flatten image
- Layer-to-frame linking system for animation

**FR-L-04: Layer Properties**
- Per-layer name (max 64 chars)
- Per-layer color tag (8 preset colors for organization)
- Per-layer user notes field

### 5.3 Drawing Tools (P0)

**FR-T-01: Pencil Tool**
- Draws single pixels at canvas zoom ≥ 1:1
- Pixel-perfect line algorithm (Bresenham's)
- No anti-aliasing (pixel art fundamental)
- Pressure sensitivity: off by default, optional tablet support (v1.0+)

**FR-T-02: Eraser Tool**
- Erases to transparent (alpha = 0)
- Same cursor/size model as pencil
- Can erase by color range (v1.0+)

**FR-T-03: Fill Tool (Flood Fill)**
- 4-connected or 8-connected fill mode (user configurable)
- Fill tolerance: 0–255 threshold for color matching
- Fill entire selection if selection active
- Fill all layers (flatten-and-fill) option (v1.0+)

**FR-T-04: Line Tool**
- Click-drag to draw pixel-perfect line
- Shift constraint: 45° / horizontal / vertical snap
- Preview line before confirming

**FR-T-05: Rectangle & Ellipse Tools**
- Outline and fill modes
- Shift to constrain to square/circle
- Preview before confirming

**FR-T-06: Eyedropper / Color Picker**
- Sample primary or secondary color from canvas
- Alt + tool key to temporarily switch to eyedropper
- Sample from: active layer, all layers, or merged

**FR-T-07: Selection Tools**
- Rectangular marquee selection
- Lasso (freehand) selection — v1.0+
- Magic wand (contiguous by color) — v1.0+
- Select all / deselect / invert selection
- Move selection (marching ants) and move pixels within selection
- Transform selection: scale, flip, rotate (90° steps, free rotate v1.0+)

**FR-T-08: Move Tool**
- Move active layer or selection
- Nudge with arrow keys (1px or 8px with Shift)

### 5.4 Color System (P0)

**FR-COL-01: Color Model**
- RGBA (8-bit per channel) primary working space
- Hex input, RGB sliders, HSL/HSV sliders
- Alpha channel control (for transparency within art, not UI)
- Primary and secondary color slots (swap with X key)

**FR-COL-02: Palette System**
- Named color palettes stored per-project
- Palette panel: grid view of swatches, list view optional
- Add color from current selection, remove color
- Reorder swatches via drag-and-drop
- Palette organization: sections/groups within palette
- Recent colors row (last 16 used)

**FR-COL-03: Palette Import/Export**
- Import: GPL (GIMP Palette), HEX list, PNG (1×N palette image)
- Export: GPL, HEX list, PNG palette strip
- Built-in palettes: DB16, DB32, NES, GameBoy, PICO-8, Endesga64

**FR-COL-04: Color Space**
- Display in sRGB
- No HDR or wide-gamut in v1.0 (scope decision)
- Future: ICC profile awareness

### 5.5 Animation System (P0)

**FR-A-01: Frames**
- Frame = one composited image at a point in time
- Each frame has: an ordered set of layer cells
- Frame duration: per-frame milliseconds (min 1ms, max 60000ms)
- Default frame duration: configurable project setting (default 100ms = 10fps)
- Duplicate frame, insert frame, delete frame, reorder frames
- Frame tags: named ranges of frames (e.g., "walk_cycle", "idle")

**FR-A-02: Timeline Panel**
- Horizontal timeline: columns = frames, rows = layers
- Cell state: empty (no pixels), populated, linked (same data as adjacent)
- Create/clear cells by clicking in timeline
- Drag frame column to reorder
- Drag layer row to reorder (syncs with layer panel)
- Scrub playhead by dragging
- Zoom timeline (horizontal) to see more or fewer frames

**FR-A-03: Playback**
- Play / Pause toggle (Spacebar or dedicated button)
- Forward and reverse playback
- Loop modes: no loop, loop, ping-pong
- Playback FPS: honor per-frame durations OR force constant FPS
- Preview plays in canvas (not a separate window, but sidebar preview optional)

**FR-A-04: Onion Skinning**
- Show N previous frames (default 1) with configurable opacity and tint
- Show N next frames with different tint
- Separate opacity control for previous vs next
- Toggle onion skinning per layer (useful for background layers)
- Color modes: fixed tint, or blend toward canvas background

**FR-A-05: Animation Tags**
- Named tags on frame ranges
- Tags have: name, color label, loop mode override
- Export can target specific tag

### 5.6 Export System (P0)

**FR-E-01: PNG Export**
- Export current frame as PNG
- Export frame range as PNG sequence
- Filename template: `{name}_{tag}_{frame:03d}.png`

**FR-E-02: Spritesheet Export**
- Pack frames into single PNG spritesheet
- Layout options: horizontal strip, vertical strip, N-column grid, optimal packing (v1.0+)
- Include/exclude specific tags
- Output JSON metadata: frame names, positions, sizes, durations
- Optional: Godot .tres, Unity .meta format (v1.0+)

**FR-E-03: GIF Export (v1.0)**
- Animated GIF from frame range or tag
- Palette quantization: 256 color limit, dithering off by default
- Transparency support
- Loop settings

**FR-E-04: Export Profiles**
- Named, saveable export configurations
- Each profile stores: format, output path template, included tags, scaling factor
- Re-run last export shortcut

### 5.7 Project System (P0)

**FR-P-01: Project Format (.rabit)**
- Binary container format (see Data Model section)
- Stores: all layers, frames, palette, canvas metadata, export profiles
- Schema-versioned for forward compatibility
- Zlib-compressed pixel data
- Human-readable header block for debugging

**FR-P-02: Project Operations**
- New project (wizard: size, FPS, color depth)
- Open project (file dialog)
- Save project (Ctrl+S)
- Save as (Ctrl+Shift+S)
- Recent projects list (last 20)
- Auto-save (every N minutes, configurable, to temp location)
- Crash recovery: detect unsaved auto-save on startup

**FR-P-03: Project Settings**
- Canvas size (with resize/crop dialog)
- Default frame duration
- Grid settings (size, color, opacity)
- Color profile (v1.0+)

### 5.8 Undo / Redo System (P0)

**FR-U-01: Command History**
- Unlimited undo (bounded by memory budget)
- Default: 200 steps before oldest are discarded
- Redo cleared on new action (standard model)
- Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y)
- History panel: shows named actions (v1.0+)

**FR-U-02: Undoable Actions**
All drawing operations, layer operations, canvas resizes, palette changes, frame operations, tool parameter changes must be undoable.

**FR-U-03: Non-Undoable Actions**
Export, save, window layout changes. These are explicitly non-undoable and documented.

### 5.9 Keyboard Shortcuts (P0)

**FR-K-01: Default Shortcuts**
- Tools: B (pencil), E (eraser), G (fill), L (line), M (rect select), V (move), I (eyedropper)
- Zoom: Ctrl++ / Ctrl+-, Ctrl+0 (fit), Ctrl+1 (100%)
- Canvas nav: Space+drag (pan), H (flip horizontal preview)
- Undo/Redo: Ctrl+Z, Ctrl+Shift+Z
- Save: Ctrl+S, Ctrl+Shift+S
- Frame: , (prev frame), . (next frame), Enter (play/pause)
- Layer: Ctrl+Shift+N (new layer), Ctrl+Shift+Delete (delete layer)

**FR-K-02: Custom Shortcuts (v1.0+)**
- Rebind any action to any key combination
- Export/import shortcut profiles
- Detect and warn on conflicts

### 5.10 UI / Application Shell (P0)

**FR-UI-01: Layout**
- Main window: resizable panels (dockable, collapsible)
- Default layout: left sidebar (tools + colors), center canvas, right sidebar (layers + timeline)
- Bottom panel: timeline / animation controls
- Top bar: menu + tool options bar

**FR-UI-02: Theme**
- Default: Dark Professional (near-black background, high-contrast UI chrome)
- Optional: Light theme (v1.0+)
- Accent color: user selectable from preset set

**FR-UI-03: Panels**
- All panels: collapsible, resizable, floatable
- Canvas: always fills remaining space after panels
- Panel state persisted across sessions

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Notes |
|---|---|---|
| Canvas render @ 1080p | ≥ 60 fps | At all zoom levels, any canvas size ≤ 4096×4096 |
| Tool response latency | < 16ms | Pencil stroke to canvas update |
| Flood fill (4096×4096) | < 500ms | Acceptable with visual progress indicator |
| Animation playback | Honors frame timing ±5ms | No frame drops at ≤ 24fps |
| Startup time | < 2 seconds | Cold start, no project |
| Undo/redo (200 ops) | < 50ms each | Regardless of canvas size |
| Export spritesheet (100 frames, 256×256) | < 5 seconds | Background, non-blocking |
| Memory ceiling | ≤ 2GB | For project with 200 frames × 4 layers × 512×512 canvas |

### 6.2 Reliability

- Zero data loss: auto-save must succeed before crash recovery is possible
- Project file must be atomic write (temp file + rename, not overwrite in place)
- Graceful degradation on malformed project files: load what is valid, report what failed

### 6.3 Cross-Platform

- Windows 10+ (primary target)
- macOS 12+ (secondary)
- Linux (Ubuntu 22.04+) (tertiary)
- Native file dialog, native window chrome where possible
- HiDPI / Retina display aware

### 6.4 Accessibility

- Keyboard fully navigable
- All icons have tooltip text
- Color choices do not rely solely on hue (shapes + labels supplement color)
- Configurable UI scale (100%–200%)

---

## 7. Constraints & Risks

### 7.1 Legal & Licensing

| Risk | Mitigation |
|---|---|
| Aseprite code copying | Original implementation only; no reference to Aseprite source |
| GIF format (patents expired) | No risk — Unisys LZW patent expired 2003/2004 |
| Third-party library licenses | Audit all deps; prefer MIT/Apache-2.0; avoid GPL in app core |
| ASE palette format | ASE is an undocumented proprietary Adobe format; implement as best-effort with disclaimer |
| Spritesheet JSON format compatibility | Own schema; optional Godot/Unity compat as export variant |

### 7.2 Security

| Risk | Mitigation |
|---|---|
| Malformed project file (binary attacks) | Rust-based deserializer with strict bounds checking; schema validation before any allocation |
| Path traversal in export paths | Sanitize all output paths; canonicalize before write |
| Arbitrary code from plugins | WASM sandbox (v1.5+); no eval, no fs access except through whitelisted API |
| Dependency vulnerabilities | Automated audit in CI (cargo audit, npm audit) |

### 7.3 Performance Risks

| Risk | Mitigation |
|---|---|
| Large canvas memory explosion | Pixel data stored as compressed chunks; lazy decompression |
| Undo stack memory bloat | Delta-based undo (store only changed pixels per operation, not full canvas snapshots) |
| UI thread blocking on export | All export on background thread; UI shows progress |
| WebGL context loss | Detect context loss event; reconstruct GPU state; notify user |

### 7.4 Product Risks

| Risk | Mitigation |
|---|---|
| Feature creep delays MVP | Strict P0/P1/P2 gating; ship v0.9 with P0 only |
| Aseprite migration friction | File importer for .aseprite format (v1.0+) to reduce switching cost |
| Pricing/distribution | Evaluate: free during beta, paid at v1.0 (one-time license, not subscription) |

---

## 8. Out of Scope (v1.0)

- Vector layer support (not a pixel art tool concern)
- Video import/export (out of scope; this is not a video editor)
- 3D viewport or voxel editing
- Cloud sync or online collaboration (v2.0 consideration)
- Mobile / tablet companion app
- AI-assisted drawing features
- Plugin marketplace

---

## 9. Success Metrics

### Adoption
- 1,000 active users within 3 months of public beta
- 10,000 downloads within 6 months of v1.0

### Quality
- ≤ 1 critical bug report per 100 active users per month at v1.0
- User-reported NPS ≥ 40 ("would recommend to another indie dev")

### Performance (measured in telemetry opt-in)
- 95th percentile canvas render time < 16ms
- < 0.1% project file corruption reports

### Engagement
- Average session length ≥ 45 minutes (professional use signal)
- Export action fires in ≥ 60% of sessions (tool is used for real work)

---

## 10. Assumptions & Dependencies

1. Users have a modern GPU supporting WebGL2 (this is near-universal as of 2024)
2. Users run on 64-bit OS with ≥ 8GB RAM (minimum; 16GB recommended for large projects)
3. Distribution via direct download (itch.io, GitHub releases) initially; Steam consideration at v1.0
4. No backend or telemetry without explicit opt-in

---

## Appendix A: Feature Priority Matrix

| Feature | Priority | Phase |
|---|---|---|
| Canvas editor (zoom, pan, grid) | P0 | MVP |
| Pixel drawing tools (pencil, eraser, fill, line) | P0 | MVP |
| Layer system | P0 | MVP |
| Frame animation + timeline | P0 | MVP |
| Onion skinning | P0 | MVP |
| Color palette system | P0 | MVP |
| Undo/redo | P0 | MVP |
| PNG / spritesheet export | P0 | MVP |
| Project save/load (.rabit) | P0 | MVP |
| Keyboard shortcuts | P0 | MVP |
| Selection tools (rect, lasso, wand) | P1 | v1.0 |
| Transform (scale, rotate, flip) | P1 | v1.0 |
| GIF export | P1 | v1.0 |
| Custom shortcuts | P1 | v1.0 |
| Palette import/export | P1 | v1.0 |
| Aseprite importer | P1 | v1.0 |
| Tile/seamless mode | P1 | v1.0 |
| Reference image layer | P1 | v1.0 |
| Blend modes | P2 | v1.5 |
| Plugin/scripting system | P2 | v1.5 |
| Collaboration / asset library | P2 | v2.0 |
| Nine-slice preview | P2 | v1.5 |

---

*End of PRD v1.0*
