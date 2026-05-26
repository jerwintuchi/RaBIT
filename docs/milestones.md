# RaBIT — Implementation Plan & Milestones
**Version:** 1.0
**Date:** 2026-04-19
**Status:** Approved for Implementation Phase

---

## 1. Philosophy

This plan breaks Phase 7 (Implementation) into 14 sequenced milestones. Each milestone has concrete exit criteria, a size estimate, and validation steps. Milestones are designed so that:

- **A walking skeleton arrives early.** By M4, the user can draw a pixel, undo it, and see it disappear. This is the single most important checkpoint — it validates that the entire stack (UI → State → Core → Rendering → Command) is wired correctly. Every later milestone is a variation on that foundation.
- **Every milestone ends in a demoable state.** No half-finished pipelines across milestone boundaries. You can stop at any completed milestone and have a working (if incomplete) app.
- **Hard architectural invariants are enforced continuously, not at the end.** ESLint `no-restricted-paths`, 60fps at 1080p, no CSS-in-JS creep — all enforced from M0 and never relaxed.
- **Performance budgets (PRD §NFRs) are measured per milestone, not just at release.** A regression in M7 is cheaper to fix than in M13.

---

## 2. Sizing Scale

No fake-precise week estimates. Relative t-shirt sizes:

| Size | Rough scope |
|---|---|
| **S** | 1–3 days of focused work; one cohesive feature |
| **M** | ~1 week; multiple related features or one complex feature |
| **L** | ~2 weeks; cross-cutting change touching multiple layers |
| **XL** | 3+ weeks; infrastructure or performance work |

Sizes assume one focused developer. Scale accordingly for parallel or context-switched work.

---

## 3. Milestone Overview

| # | Milestone | Size | Depends on | Release checkpoint |
|---|---|---|---|---|
| M0 | Project scaffold | M | — | — |
| M1 | Design tokens + primitive components | M | M0 | — |
| M2 | Editor core: data types + stores + command system | M | M0 | — |
| M3 | WebGL2 renderer foundation | L | M0 | — |
| M4 | 🚩 **Walking skeleton: pencil tool end-to-end** | L | M1, M2, M3 | Internal alpha |
| M5 | Remaining MVP drawing tools | M | M4 | — |
| M6 | Layer panel + layer operations | M | M4 | — |
| M7 | Color + palette panels | M | M1 | — |
| M8 | Frames + timeline + animation + onion skinning | L | M4, M6 | — |
| M9 | File I/O: save/open `.rabit` | M | M2 | — |
| M10 | Auto-save + crash recovery | S | M9 | — |
| M11 | PNG + spritesheet export | M | M3, M8 | Internal beta |
| M12 | Preferences + keybindings | S | M1, M2 | — |
| M13 | 🚩 **Polish, performance audit, security review** | L | all prior | **v1.0 release candidate** |
| M14 | P1 features: selection tools, GIF export, pixel-perfect, mirror, tile, frame tags, layer FX, reference image, nine-slice, palette-from-canvas | ✅ Done | M13 | — |
| M15 | Painting depth: custom brush shapes + indexed color mode | M | M14 | — |
| M16 | Layer & frame organization: layer groups + per-frame layer visibility | L | M15 | — |
| M17 | Workflow utilities: spritesheet import + undo history panel | M | M14 | V2 release candidate |

Total MVP scope: 13 milestones, estimated **15–22 weeks** end-to-end for a single focused developer.

---

## 4. Milestone Details

### M0 — Project scaffold
**Size:** M

**Goal:** Empty-but-correct repo that lints, type-checks, runs a dev server, and can be built as a Tauri app.

**Deliverables:**
- `pnpm create vite` + React + TS + Tauri 2 init
- Rust workspace (`src-tauri/`) with minimal main.rs
- `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`
- `eslint.config.js` (flat config, v9) with `@typescript-eslint` and `eslint-plugin-import`
- **`no-restricted-paths` rule** enforcing architecture §4 layered imports
- Prettier 3 with `.prettierrc`
- `rustfmt.toml`, `clippy.toml` (deny warnings)
- `.github/workflows/ci.yml` — PR: lint + type + test + cargo check + clippy + fmt check
- Folder layout matching stack.md §4
- CLAUDE.md + docs/ + .rabit-memory/ already in place; verify referenced files exist

**Exit criteria:**
- `pnpm install && pnpm dev` opens a blank Tauri window with "Hello RaBIT"
- `pnpm lint` passes with no warnings
- `pnpm typecheck` passes
- `cargo build --manifest-path src-tauri/Cargo.toml` succeeds
- CI green on a trivial PR

**Validation:** Smoke test only — there are no features to test yet.

---

### M1 — Design tokens + primitive components
**Size:** M

**Goal:** All primitive UI components exist, styled per design-system.md, with a visual dev harness.

**Deliverables:**
- `src/styles/tokens.css` with every CSS custom property from design-system.md §3
- `src/styles/reset.css` — minimal normalization
- Primitives: Button (4 variants × 3 sizes), Input (text + number + drag-scrub), Slider, Checkbox, Toggle, Dropdown, Panel, ContextMenu, Tooltip, ModalDialog, ProgressBar
- Icon components via SVGR (minimum set: 20 icons for MVP tools + UI)
- A `/dev/components` route showing each component in all states (hover/active/disabled/focus) — used for manual design QA
- CSS Modules for every component; zero hardcoded colors or sizes

**Exit criteria:**
- Every primitive from design-system.md §4 exists and matches the spec visually
- Every component passes `:focus-visible` keyboard navigation
- Contrast audit: automated check confirms WCAG AA on text-on-background combinations
- The `/dev/components` harness is usable for visual regression

**Validation:**
- Automated: Vitest snapshot tests on each primitive's rendered DOM
- Manual: Open `/dev/components`, verify each component matches the design system section by section

---

### M2 — Editor core: data types + stores + command system
**Size:** M

**Goal:** All pure-TypeScript core logic exists with no rendering. Fully unit-testable.

**Deliverables:**
- `src/core/DataModel/` — all types from data-model.md §2 as interfaces and factory functions
- `src/core/CommandSystem/` — Command interface, CommandManager (execute/undo/redo/merge/trim)
- `src/state/` — all Zustand stores (Project, Layer, Frame, History, Palette, Tool, UI) per architecture §9
- Action composers in `src/state/action-composers/` for cross-store logic (e.g., `goToFrame`)
- At least one concrete Command implementation (NoOp or a trivial test command) — the real commands land in later milestones

**Exit criteria:**
- Every type in data-model.md §2 exists in code with matching field names/types
- CommandManager unit tests: execute pushes to undo stack; undo pops and moves to redo; new execute clears redo; maxHistory trimming works; command merging works for consecutive same-type commands
- All stores have unit tests for reducers
- `no-restricted-paths` confirms: no React imports anywhere in `src/core/` or `src/state/`

**Validation:**
- Automated: Vitest unit tests, target ≥ 80% coverage on `src/core/` and `src/state/`
- No manual UI testing (nothing is rendered yet)

---

### M3 — WebGL2 renderer foundation
**Size:** L

**Goal:** A `<CanvasViewport>` React component that renders a composited canvas to screen. No drawing tools yet — it just displays layer data from stores.

**Deliverables:**
- `src/render/` — RenderingEngine class with WebGL2 context, framebuffers (composite, scratch, onion), quad VBO
- Shaders: `checkerboard.frag`, `composite.frag` (with all 6 blend modes), `grid.frag`
- TextureCache (LRU, 64-texture budget, tiled for canvases ≥ 2048×2048 per architecture §6)
- Dirty flag system (`LAYER_DATA | LAYER_ORDER | ONION | OVERLAY | FULL`)
- `<CanvasViewport>` component — hosts `<canvas>`, wires resize observer, ticks render loop with `requestAnimationFrame`
- Pan + zoom with integer zoom levels (1×, 2×, 4×, 8×, 16×, 32×) + fit-to-window
- Viewport chrome: zoom display, cursor coordinates, cursor color — bottom of viewport

**Exit criteria:**
- Loading a test project fixture (hardcoded 32×32 two-layer checker pattern) renders correctly with correct blend modes
- Pan (Space+drag or Hand tool) works smoothly at 60fps
- Zoom in/out via Ctrl+scroll, Ctrl++/-, Ctrl+0 (fit)
- A 4096×4096 test canvas renders at ≥ 60fps with 4 layers
- Dirty flag verified: changing layer opacity triggers re-composite only, not re-upload

**Validation:**
- Automated: Playwright test loading the fixture, asserting pixel color at specific canvas coords via `gl.readPixels`
- Manual performance: open 4K test canvas, pan + zoom, monitor frame time in dev tools. Log if any frame exceeds 16ms.

---

### M4 — 🚩 Walking skeleton: pencil tool end-to-end
**Size:** L

**This is the single most important milestone.** The full stack is validated here. Every subsequent milestone is easier because the pipeline is proven.

**Goal:** Click-and-drag on canvas → stroke appears in real time → pointerUp commits a DrawCommand to the undo stack → Ctrl+Z undoes it → stroke disappears.

**Deliverables:**
- `src/core/ToolEngine/` — Tool interface, ToolEngine state machine, pointer event normalization to `CanvasPointerEvent` (architecture §7)
- `src/core/tools/PencilTool.ts` — the full pencil implementation: pointer event → scratchBuffer GPU render → pointerUp → DrawCommand with delta pixels
- `src/core/commands/DrawCommand.ts` — delta-based pixel storage and execute/undo per data-model
- Ctrl+Z / Ctrl+Y wired to `useHistoryStore`
- Integration: every PencilTool test that succeeds proves architecture.md §5 (commands), §6 (rendering), §7 (tools), §9 (stores) are all correctly integrated
- Basic ToolBar UI with Pencil button (left rail)
- Basic cursor swap when Pencil is active

**Exit criteria:**
- Draw 1000 pixels in a single stroke at 60fps (no dropped frames in scratch preview)
- Single undo removes the entire stroke (stroke = one merged DrawCommand)
- Undo of a 32×32 pencil stroke on a 4096×4096 canvas completes in < 50ms (PRD budget)
- Memory: 100 strokes on a 512×512 canvas stays under the delta-undo budget (< 50MB per data-model analysis)
- Cross-layer test: drawing on layer 2 doesn't touch layer 1's data

**Validation:**
- Automated: Playwright simulates pointer events on canvas; asserts DrawCommand was pushed to history store; asserts undo reverses the change
- Manual: draw continuously for 30 seconds; verify no visible lag, memory monitor shows stable consumption
- **Release checkpoint:** Internal alpha. Everything downstream builds on this.

---

### M5 — Remaining MVP drawing tools
**Size:** M

**Goal:** All P0 drawing tools from PRD work identically to the Pencil pattern.

**Deliverables:**
- Eraser (replaces pixels with transparent, same delta pattern as pencil)
- Line (Bresenham algorithm, Shift-constraint to 45° increments; preview on scratchBuffer; commits on pointerUp)
- Fill (invokes Rust IPC `flood_fill` command; Rust returns delta mask; DrawCommand stores it)
- Eyedropper (reads pixel at cursor, sets primaryColor in useToolStore)
- Hand (pan — already in M3, just wires to a tool slot)
- Zoom tool (click to zoom, Alt-click to zoom out)
- ToolBar UI with all icons + active-tool highlight + shortcuts
- Tool options bar below canvas (size, opacity, tolerance per data-model)

**Exit criteria:**
- Every P0 tool from PRD is functional
- Tool keyboard shortcuts (B/E/L/G/I/H/Z) switch active tool
- Space held → temporary Hand tool (release returns to prior tool)
- Tool options bar updates context-sensitively on tool change
- Flood fill of a 4096×4096 canvas completes in < 300ms on a mid-range CPU (PRD perf target)

**Validation:**
- Automated: one Playwright test per tool verifying basic behavior
- Manual: use each tool for 5 minutes; note any unexpected cursor, keyboard, or state bugs

---

### M6 — Layer panel + layer operations
**Size:** M

**Goal:** Full layer management UI.

**Deliverables:**
- LayerPanel component per design-system.md §6.1
- Actions: Add layer, Delete, Duplicate, Merge down, Rename (inline edit on double-click), Reorder (drag-and-drop)
- Visibility toggle, lock toggle (lock prevents drawing, shows cursor indicator)
- Blend mode dropdown + opacity slider (footer)
- Layer thumbnails — live-rendered (re-rendered on layer texture change, throttled to ≤ 4Hz)
- Layer multi-select (Shift+click, Ctrl+click) — for group operations
- All layer mutations flow through CommandSystem (undo/redo works for every op)

**Exit criteria:**
- All layer ops reversible via undo
- Drag-to-reorder is smooth, with clear drop indicator
- Drawing on a locked layer is a no-op with visible feedback (shake animation? cursor change? — pick one)
- Thumbnails stay ≤ 4Hz update rate under rapid drawing (performance guard)
- 100-layer project still scrolls at 60fps (virtualization required per design-system.md §12.7)

**Validation:**
- Automated: Vitest for each layer op; Playwright for drag-reorder
- Manual: create 50 layers, reorder extensively, verify no visual glitches

---

### M7 — Color + palette panels
**Size:** M

**Goal:** Full color picking + palette management.

**Deliverables:**
- ColorPickerPanel per design-system.md §6.2 — HSV/RGB/Hex tabs, primary/secondary wells, X swap, D reset
- PalettePanel per §6.3 — swatch grid, add/edit/delete, size toggle (S/M/L)
- Palette import adapters: GPL (GIMP), hex list, CSV — all implemented in TypeScript (no Rust dependency yet)
- Palette export: same set + PNG swatch strip (uses Rust export pipeline to write PNG)
- Color history (recently used N colors, shown as a row below the wells)

**Exit criteria:**
- All three picker modes stay in sync (change in one tab reflects in others instantly)
- Hex input accepts both 6-char (RRGGBB) and 8-char (RRGGBBAA) input
- Palette import: load a well-known GPL palette (e.g., PICO-8) and verify all 16 colors match
- Palette edit (change color of a swatch) pushes a Command (undo works)

**Validation:**
- Automated: round-trip tests — pick color in HSV → read in RGB → read in Hex → must match
- Manual: verify picker color accuracy against an external reference (e.g., open an image in another tool, eyedrop both, compare)

**Deferred to M11:** ASE and PSP PAL import (they need Rust-side parsing; pair with file I/O work).

---

### M8 — Frames + timeline + animation + onion skinning
**Size:** L

**Goal:** Full animation workflow.

**Deliverables:**
- Timeline component per design-system.md §6.4 — controls row, layer labels, frame grid
- Frame ops: Add, Delete, Duplicate, Reorder, Reverse range, Set duration
- Cell ops: Clear cell (make empty), Link cell (reuse prior frame's cell), Unlink cell
- Playback engine: Play, Pause, Loop, FPS control
- Onion skinning — tinted prior/next frames rendered to onionBuffer (architecture §6)
- Tags: create/edit/delete (named frame ranges); timeline highlights tagged ranges
- All frame + cell ops flow through Command system

**Exit criteria:**
- Play a 24-frame loop at 24fps with 4 visible layers — smooth, no dropped frames
- Linked cells correctly resolve to prior non-linked cell on render
- Onion skin shows ±3 frames with configurable opacity
- Tag-based playback (play only frames within a tag range) works
- Timeline scrolls smoothly for 200+ frames (virtualization)

**Validation:**
- Automated: Playwright scripts frame navigation and playback
- Manual: create a 16-frame walk cycle, verify feel at 12fps / 24fps / 60fps

---

### M9 — File I/O: save/open `.rabit`
**Size:** M

**Goal:** Native save/open with atomic write, integrity verification, and hard-limit enforcement.

**Deliverables:**
- Rust `project_io` module — serialize/deserialize per data-model.md §3
- Rust `fs_sandbox` module — path canonicalization + allowlist (architecture §11)
- Atomic write sequence (architecture §12) — `.tmp` → verify → rename
- Migration pipeline stub (`migrate_v0_to_v1` is a no-op; infrastructure in place)
- Tauri commands: `save_project`, `open_project`, `save_project_as`
- TypeScript bridge wrappers in `src/bridge/tauri-commands.ts`
- Hard-limit validation on open (data-model.md §3.6) — reject oversized files
- File → Save / Save As / Open UI + File menu

**Exit criteria:**
- Round-trip: create project, save, close, reopen — pixel-identical
- Byte-identical round-trip with no edits (nice-to-have; not blocking)
- Atomic write verified: kill app mid-save, verify original `.rabit` file is untouched
- Hard-limit rejection: craft a malicious file exceeding any limit, verify rejection with user-friendly error
- Save a 100-frame × 4-layer × 512×512 project: file size < 10MB, save time < 500ms

**Validation:**
- Automated: proptest round-trip tests on the Rust deserializer with random valid Project structures
- Automated: fixture-based tests for hard-limit violations
- Manual: test atomic write via killing the process mid-save (external kill, not in-app)

---

### M10 — Auto-save + crash recovery
**Size:** S

**Goal:** Periodic auto-save; recovery dialog on startup if prior session crashed.

**Deliverables:**
- Rust `auto_save` module: periodic timer, write to user data dir, update `autosave-manifest.json`
- Rust `crash_recovery` module: scan manifest on startup, compare timestamps
- React recovery dialog (design-system.md §9)
- Preferences: autosave interval (default 5 min, settable 1–30 min or off)

**Exit criteria:**
- Auto-save runs at configured interval, emits `autosave:complete` event, shows notification bar
- Force-kill app mid-session; relaunch; recovery dialog offers the last auto-saved state
- Declined recovery → auto-save is deleted
- Restored recovery → opens as an untitled project (user must Save As)

**Validation:**
- Automated: time-accelerated tests in Rust for the auto-save scheduler
- Manual: force-kill the app multiple times in different states (mid-draw, mid-save, mid-export); verify each recovers gracefully

---

### M11 — PNG + spritesheet export
**Size:** M

**Goal:** Export pipeline per data-model.md §5–6.

**Deliverables:**
- Rust `export` module — PNG single-frame, PNG per-layer, PNG all-frames-separate, spritesheet
- Spritesheet layouts: horizontal, vertical, grid
- Sidecar JSON per data-model.md §6.3
- Integer-only upscale (nearest-neighbor) at 1×/2×/4×/8×/16×
- Export dialog UI (design-system.md §4.9) with non-blocking progress events
- ASE palette + PSP PAL imports (rust-side parsing, deferred from M7)

**Exit criteria:**
- 100-frame × 256×256 spritesheet export completes in < 5 seconds (PRD target)
- Export runs non-blocking — user can continue editing during export
- Exported PNG opens correctly in at least 3 third-party tools (browsers, Photoshop, Aseprite)
- Sidecar JSON imports correctly into a test Godot/Unity project
- ASE palette warning banner appears on ASE import

**Validation:**
- Automated: round-trip tests — export PNG, re-import via a test harness, verify pixel match
- Manual: test in external tools (Photoshop, Godot) that outputs import correctly
- **Release checkpoint:** Internal beta. Users can produce shippable content.

---

### M12 — Preferences + keybindings
**Size:** S

**Goal:** User settings persist across sessions; keyboard shortcuts are customizable.

**Deliverables:**
- Preferences dialog per design-system.md §4.9
- TOML read/write in Rust per data-model.md §8
- Recent files list (max 10, click to reopen)
- Keybinding editor with conflict detection
- UI scale multiplier (0.9 / 1.0 / 1.25)
- Reset-to-defaults button

**Exit criteria:**
- Preferences persist across app restart
- Remapped keybinding takes effect immediately (no restart)
- Corrupt preferences file → silently falls back to defaults + warning notification
- Recent files list handles missing files gracefully (shown greyed out, removed on next launch)

**Validation:**
- Automated: TOML round-trip tests; conflict-detection logic tests
- Manual: remap 3–4 shortcuts; verify they persist and work

---

### M13 — 🚩 Polish, performance audit, security review
**Size:** L

**Goal:** v1.0 release candidate.

**Deliverables:**
- Run `/simplify` skill across the codebase; fix issues
- Run `/security-review` skill on all Rust IPC commands + deserializer
- Performance audit against every PRD NFR (canvas 60fps, tool latency < 16ms, cold start < 2s, memory < 2GB for 200×4×512, undo < 50ms, export < 5s)
- Memory leak audit: 1-hour drawing session should stay within ±10% of baseline
- Cross-OS testing: install + basic workflow on Windows, macOS (Intel + ARM), Linux (Ubuntu + Fedora)
- Installer/distribution: MSI + NSIS (Win), DMG (mac, universal), AppImage + deb (Linux), signing where certs available
- Privacy policy + EULA text (offline-only — short document)
- CHANGELOG.md for v1.0
- "What's new" in-app dialog

**Exit criteria:**
- Every NFR from PRD passes on a baseline machine
- `/security-review` returns no High or Critical findings
- No known crashes in a 1-hour stress test on each OS
- Installer produces a launchable app on a clean VM (no dev tools installed)
- Binary sizes: < 50MB Windows, < 100MB macOS universal, < 60MB Linux

**Validation:**
- Automated: full CI suite green, performance benchmarks within budgets
- Manual: cross-OS smoke test (60-min session on each)
- **Release checkpoint:** Tag `v1.0.0`, publish to release page.

---

### M14+ — Post-MVP (P1, P2)
Not part of v1.0 scope. Planning only, not prescriptive sequence:

- Selection tools (Marquee, Lasso, Magic Wand) — architecture §3 already has SelectionEngine stub
- GIF export (using `gif` + `color_quant`, NOT gifski per stack.md §3.5)
- Plugin system (P2) — major security boundary; separate design phase required before code
- Indexed color mode (v2)
- Per-cell bounding boxes (v2)
- WebGPU renderer (v2)

Each post-MVP feature should be planned as its own mini-project with a design doc, not retrofitted in as "just one more thing."

---

## 5. Cross-Milestone Invariants

These hold from M0 through M13. Regressions are blockers for the milestone in which they occur, not tech debt to fix later.

### 5.1 Architectural Invariants

- `no-restricted-paths` ESLint rule always passes (layer boundaries enforced)
- No React imports in `src/core/` or `src/state/`
- No `std::fs::write` calls outside `fs_sandbox` (Rust)
- Every canvas mutation flows through CommandSystem (enforced by code review + eventually a runtime assertion in dev mode)
- No CSS-in-JS creeping in; no utility CSS framework (Tailwind) creeping in

### 5.2 Performance Invariants

- Canvas render ≥ 60fps at 1080p up to 4096×4096
- Tool response latency < 16ms from pointer event to scratch preview
- No frame drops during undo/redo of typical strokes
- Memory stays within PRD budget for the reference workload

### 5.3 Security Invariants

- Every Tauri command validates input (no trust in renderer)
- Every file path goes through `fs_sandbox`
- Hard limits in deserializer enforced before allocation
- No network calls in the shipping binary (offline-only per risks/security.md)
- `cargo audit` + `pnpm audit` clean in CI

### 5.4 Testing Invariants

- Unit tests run on every PR; CI blocks merge on failure
- Playwright E2E runs on main branch + before each release
- Rust proptest suite runs nightly + before each release
- No skipped/disabled tests merged to main

---

## 6. Risk Register

Things that could slip, with mitigations:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Delta undo memory blows past budget on unusual workloads | M | M | Profile early (M4) with synthetic workloads; flood fill has a documented mitigation (data-model.md). Add an undo-size warning in UI. |
| WebGL2 + Tauri 2 WebView inconsistency across OSes | M | H | Test on all target OSes starting in M3; not M13. Document known WebView quirks. |
| Atomic write fails on network drives / OneDrive / Dropbox | M | M | Document supported filesystems; detect network drives + warn user. Don't block save. |
| Large canvas (4096²) flood fill blocks UI thread | L | H | Rust implementation is in a separate process via Tauri IPC; UI thread stays free. Verify in M5. |
| Font rendering differences across OSes with bundled Inter | L | L | WOFF2 + identical browser engine (WebView) per OS minimizes this. Manual cross-OS spot-check at M13. |
| pnpm + Tauri + Rust build on Windows has path-length issues | M | M | Use short workspace paths; document the `git config core.longpaths true` requirement on Windows. |
| Playwright tests are flaky on CI | M | L | Use `--retries=2`; prefer pixel assertions with small tolerances over exact match; isolate each test's state. |
| Scope creep — "just one more blend mode" / "just one more tool" | H | H | PRD lists exact MVP scope. Every out-of-scope request goes on a P1 backlog, not into a milestone. |

---

## 7. Parallelization Opportunities

If a second developer joins, these milestones can run in parallel with the critical path:

- **M1 and M2** — Independent (primitives vs core logic)
- **M7 (Color+Palette)** can start any time after M1
- **M9 (File I/O)** can start any time after M2 (doesn't need rendering)
- **M10 (Auto-save)** follows M9 but doesn't block other work
- **M11 (Export)** depends on M3+M8 for rendering + animation, but can be started at M8

Critical path: **M0 → M3 → M4 → M8 → M13**. Any other milestone is either a prerequisite satisfied early or a parallelizable track.

---

## 8. Milestone Status Tracking

Each milestone should have a dedicated memory file at `.rabit-memory/impl/m{N}.md` created when the milestone starts. It records:

- Entry date, completion date
- Exit criteria checkboxes
- Deviations from the plan (and why)
- Surprises or learnings worth preserving
- Follow-up work spawned

At M13 completion, these files become the build history of v1.0.

---

---

## 9. V2 Milestones (M15–M17)

These milestones extend RaBIT beyond the V1 feature set. They follow the same spec-driven workflow (Requirements → Design → Tasks → Implementation) as M0–M14. All three are approved and have full specs under `specs/`.

---

### M15 — Painting Depth
**Size:** M
**Depends on:** M14

**Goal:** Make painting feel professional. Pixel artists need multi-pixel brushes and palette discipline — without these, RaBIT is slower than any comparable tool.

**Features:**
- **Custom Brush Shapes** — sizes 1–16px, square and round shapes, brush cursor overlay, `[`/`]` size shortcuts. Core change in `BrushTool.paintFootprint()`.
- **Indexed Color Mode** — paint-time snap to nearest palette swatch; warning indicator on color well; "Quantize to palette" command in Edit menu; toggle in palette panel header.

**Exit criteria:**
- Painting with size-5 round brush writes a correct circular footprint
- `[`/`]` keys adjust brush size while painting
- With indexed mode on, every stroke snaps to the nearest palette color
- "Quantize to palette" is undoable; pixels match the nearest swatch
- `pnpm build` + `pnpm test` green

**Specs:** `specs/custom-brush-shapes/`, `specs/indexed-color-mode/`

---

### M16 — Layer & Frame Organization
**Size:** L
**Depends on:** M15

**Goal:** Support projects with many layers and complex animations. Flat layer lists and always-on visibility are limiting once a project has 10+ layers and 20+ frames.

**Features:**
- **Layer Groups** — one-level collapsible folders in layer panel + timeline; group has its own blend mode and opacity; group members composite into a temp FBO; cascade delete. Data model: `type: 'layer'|'group'` and `parentGroupId` on `Layer`.
- **Per-Frame Layer Visibility** — `hiddenLayerIds: string[]` on `Frame`; toggle via right-click on timeline frame cell; diagonal-stripe indicator on hidden cells; global visibility always wins.

**Exit criteria:**
- Create a group, add 2 layers, collapse/expand; verify render output is correct
- Per-frame hide: layer hidden on frame 2, visible on frame 1 and 3; verified visually and in export
- Both features save/load correctly in `.rabit` format (old files still open)
- `pnpm build` + `cargo build` + `pnpm test` green

**Specs:** `specs/layer-groups/`, `specs/per-frame-layer-visibility/`

---

### M17 — Workflow & Import
**Size:** M
**Depends on:** M14 (can run in parallel with M16)

**Goal:** Remove two of the most common workflow friction points: importing existing spritesheets, and navigating undo history without guesswork.

**Features:**
- **Spritesheet Import** — File → Import Spritesheet; Tauri IPC `import_image` loads PNG/BMP/WebP; dialog with live grid preview; single atomic command (one undo step); import as new project or append frames.
- **Undo History Panel** — scrollable list of all undo/redo entries; click to jump to any point; hidden by default; toggled from View menu; no thumbnails.

**Exit criteria:**
- Import a 128×64 spritesheet with 8×8 cells → 16 frames created with correct pixels
- Undo of the import removes all 16 frames in one step
- Undo history panel shows correct entries; click on entry 3-back navigates correctly
- Panel toggle persists across layout changes
- `pnpm build` + `cargo build` + `pnpm test` green
- **Release checkpoint:** V2 tag once M15 + M16 + M17 all complete.

**Specs:** `specs/spritesheet-import/`, `specs/undo-history-panel/`

---

*End of Implementation Plan & Milestones v1.1*
