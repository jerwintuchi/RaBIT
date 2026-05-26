# RaBIT — Claude Code Project Context

RaBIT (Raster + Bit creation system) is a professional-grade desktop pixel art and sprite animation editor. Target users: indie game developers and digital artists. Positioned as a studio-grade Aseprite alternative with a modern, minimal UI (Figma/Blender feel — NOT retro/playful).

## Current Build Phase

**Always check `.rabit-memory/phase-tracker.md` for the latest phase status.**

| Phase | Title | Status | Output |
|---|---|---|---|
| 1 | Product Requirements Document | ✅ Done | `docs/PRD.md` |
| 2 | System Architecture Design | ✅ Done | `docs/architecture.md` |
| 3 | UI/UX Design System | ✅ Done | `docs/design-system.md` |
| 4 | Technical Stack Decision | ✅ Done | `docs/stack.md` |
| 5 | Data Model + File Format | ✅ Done | `docs/data-model.md` |
| 6 | Implementation Plan / Milestones | ✅ Done | `docs/milestones.md` |
| 7 | Core Implementation (M0–M14 complete) | 🔨 Active — V1 pass + release tag pending | `src/` |
| 8 | Optimization + Refactoring | ⏳ Pending | — |

**Phase 7 milestone summary (all shipped):**
- M0–M6: Project scaffold, canvas, WebGL renderer, layer system, basic tools, undo/redo, file I/O
- M7–M9: Timeline, frame animation, onion skinning, palette, color picker, auto-save, crash recovery
- M10–M11: Export (PNG, spritesheet, GIF), preferences, keybindings
- M12–M13: Selection tools (marquee, lasso, magic wand), floating selection, move tool, canvas resize
- M14: Pixel-perfect mode, reference image, nine-slice preview, layer FX (outline), frame tags, palette-from-canvas, tile mode, mirror mode, GIF export

**What remains before V1 release tag:** final QA pass, performance profiling, release packaging.

## Key Documents (read these before working on any phase)

- `docs/PRD.md` — full product requirements, feature priority matrix (P0/P1/P2), personas, NFRs
- `docs/architecture.md` — system layers, module dependency graph, command system, rendering pipeline
- `.rabit-memory/MEMORY.md` — memory index (decisions, risks, design notes)
- `.rabit-memory/phase-tracker.md` — current phase status (authoritative)

## Confirmed Stack

| Layer | Technology |
|---|---|
| Desktop shell | **Tauri** (Rust backend) |
| UI framework | **React 18 + TypeScript** |
| Canvas renderer | **WebGL2** (custom, no Three.js) |
| State management | **Zustand + Immer** |
| Build tool | **Vite** |
| Testing | **Vitest** (unit) + **Playwright** (E2E) |
| Rust crates | serde, rmp-serde, zstd, image, png, rayon, gif + color_quant |

## Architecture Principles (non-negotiable)

1. **No upward imports.** Dependency direction: `UI → State → Editor Core → Tauri IPC → Rust`. Never reverse this.
2. **Every canvas mutation is a Command.** No direct pixel writes outside the command system. This is how undo/redo works.
3. **Delta-based undo.** Store only changed pixels per operation, not full canvas snapshots. Required for 4K canvas memory budget.
4. **GPU renders, Rust writes files, TypeScript orchestrates.** Never do file I/O in JavaScript. Never block the UI thread.
5. **Stroke preview on scratchBuffer (GPU only).** Only committed to undo stack on `pointerUp`.
6. **Atomic file writes.** Write → `.rabit.tmp` → checksum verify → OS rename. Never overwrite `.rabit` in place.

## Implemented Feature Scope

**P0 (MVP) — all complete:** Canvas editor up to 4096×4096, pencil/eraser/fill/line/rect/ellipse tools, layer system, frame animation + timeline, onion skinning, RGBA color palette, unlimited delta-based undo/redo, PNG + spritesheet export, `.rabit` project format, keyboard shortcuts, auto-save, crash recovery, preferences, keybindings.

**P1 — all complete:** GIF export, selection tools (marquee/lasso/magic wand), floating selection + move, canvas resize, pixel-perfect brush, mirror mode, tile mode, reference image, frame tags, layer FX (outline), palette-from-canvas, nine-slice preview.

**P2 — not started:** Plugin system. Do not build ahead of current V1 release pass.

## Brand & Design Direction

- Dark professional UI — near-black background, high contrast
- Feel: Figma / Blender / Adobe — NOT Aseprite, NOT retro
- No playful/rabbit mascot branding — "RaBIT" is purely the acronym
- Keyboard-first design; minimize clicks for common operations

## Legal Constraints

- Zero Aseprite source reference — original implementation only
- All deps must be MIT or Apache-2.0 — no GPL in the app core
- GIF format: safe (LZW patents expired 2003/2004)
- ASE palette format: implement as best-effort with disclaimer (undocumented Adobe format)

## Performance Budgets

| Metric | Target |
|---|---|
| Canvas render @ 1080p | ≥ 60fps (all zoom levels, ≤ 4096×4096) |
| Tool response latency | < 16ms |
| Cold start | < 2 seconds |
| Memory (200 frames × 4 layers × 512×512) | ≤ 2GB |
| Undo/redo | < 50ms per op regardless of canvas size |
| Export (100 frames, 256×256 spritesheet) | < 5 seconds, non-blocking |

## Project Memory System

All architectural decisions, known risks, and phase context live in `.rabit-memory/`. Read `.rabit-memory/MEMORY.md` for the index. After completing any phase or making a significant decision, update the relevant memory file and the phase tracker.

## Autonomous Agent & Skill Use

Read `.rabit-memory/agents-and-skills.md` for the full map. Summary:

- **Subagents:** Use proactively without being asked. Launch parallel agents in one message when tasks are independent.
  - `Explore` → codebase search/audit
  - `Plan` → module design before coding
  - `general-purpose` → library research, multi-step lookups
- **Skills:** Invoke proactively when the trigger condition matches.
  - `simplify` → after implementing any module; **before applying any deletion it proposes, cross-check Section 11 (Protected UI Behaviors) and confirm with the user**
  - `security-review` → before any release checkpoint; after Rust IPC / file I/O work
  - `anthropic-skills:skill-creator` → when a recurring RaBIT workflow needs a dedicated skill
  - `anthropic-skills:consolidate-memory` → when `.rabit-memory/` grows redundant

---

# Project Operating Manual

> This governs how AI assistants work on this project. Read it fully before making any changes.

---

## 1. Project Context

**Project name:** RaBIT (Raster + Bit creation system)
**Purpose:** Professional-grade desktop pixel art and sprite animation editor for indie game developers and digital artists
**Status:** Phase 7 active — Milestones M0–M14 shipped; V1 release pass in progress
**Primary language/stack:** TypeScript + React 18, WebGL2, Zustand + Immer, Tauri (Rust), Vite

**Key reference documents** (read these before working):
- `docs/PRD.md` — product requirements, feature priorities, personas
- `docs/architecture.md` — system layers, module dependency graph, rendering pipeline
- `.rabit-memory/MEMORY.md` — memory index (decisions, risks, design notes)
- `.rabit-memory/phase-tracker.md` — current phase status (authoritative)

**Out of scope / do not touch:**
- `docs/` — documentation files; update only when a phase completes or a significant decision is made
- Never modify `.rabit` file format handling without a spec
- Never add dependencies without explicit user approval

---

## 2. Core Principles

1. **Think before coding.** State the plan, wait for approval, then implement.
2. **Read before writing.** Always inspect existing code before modifying or adding.
3. **Smallest viable change.** Solve the asked problem. No unrequested refactors.
4. **Verify before declaring done.** Run build and tests after every change.
5. **Root-cause, don't patch.** If a fix fails twice, stop and diagnose — do not repeat the same approach.
6. **Match the project.** Follow existing patterns, naming conventions, and libraries already in use.

---

## 3. Spec-Driven Workflow

**Apply to every change — features, bugfixes, and refactors alike.** Do NOT skip stages. Wait for approval at each checkpoint before proceeding.

> Note: "Stage" here refers to the spec workflow steps. "Phase" refers to the RaBIT build roadmap above. They are separate concepts.

### Stage 1 — Requirements
Create `specs/<feature-or-bug-name>/requirements.md` with:
- **Problem statement** — what are we solving and for whom
- **User stories** — "As a `<role>`, I want `<capability>`, so that `<benefit>`"
- **Acceptance criteria** — testable conditions in WHEN/THEN format
- **Out of scope** — what this change will NOT do
- **Open questions** — anything needing clarification before design

**Checkpoint: user must approve before Stage 2.**

### Stage 2 — Design
Create `specs/<feature-or-bug-name>/design.md` with:
- **Approach** — high-level strategy
- **Affected components** — which files/modules change and why
- **Data model changes** — new/modified schemas, types, interfaces
- **Key flows** — sequence of operations for primary use cases
- **Trade-offs** — what was chosen and what was rejected, with rationale
- **Risks** — what could go wrong

**Checkpoint: user must approve before Stage 3.**

### Stage 3 — Tasks
Create `specs/<feature-or-bug-name>/tasks.md` as an ordered checklist:
- Each task: description, files touched, acceptance check
- Tasks are small (< 1 hour each)
- Explicit dependencies listed (e.g. "Task 3 depends on Task 1")
- Final task is always a verification step

**Checkpoint: user must approve before Stage 4.**

### Stage 4 — Implementation
- Execute tasks in order, one at a time
- After each task: run build + tests, report what was done and verified
- Mark completed tasks `[x]` in the task list
- If blocked, stop and surface the issue — do not improvise a workaround

---

## 4. Bugfix Workflow

Bugs still follow the full Stage 1–4 workflow. Use the condensed bugfix template for Stage 1 + 2 combined:

Create `specs/<bug-name>/bugfix.md` with:
- **Bug description** — observed vs expected behavior
- **Reproduction steps**
- **Root cause** — what is actually broken (after investigation, not guessing)
- **Fix approach** — minimal change to correct it, files affected
- **Regression check** — how we verify the fix and prevent recurrence

**Checkpoint: user must approve before implementation (Stage 4).**

---

## 5. Code Change Rules

### Before writing code
- State what will change, which files, and the expected outcome
- Re-read all affected files — do not rely on memory of prior reads

### While writing code
- Match existing naming, structure, and import conventions
- Do not add dependencies without asking
- Do not change public interfaces without flagging it
- Do not rewrite working code for cleanliness unless asked
- Honor all Architecture Principles listed above — they are non-negotiable

### After writing code
- Run build and type check
- Run relevant tests; write tests if none exist for this area
- Report: what changed, what passed, what could not be verified

---

## 6. Anti-Patterns (root causes of past bugs)

- Jumping to code without reading existing files first
- Making broad changes across many files in one shot
- Adding "helpful" features that were not requested
- Patching symptoms instead of diagnosing root causes
- Repeating the same failed approach with minor tweaks
- Introducing abstractions for hypothetical future needs
- Silent failures — always surface errors explicitly

---

## 7. Verification Commands

```
Build:       pnpm build          # tsc --noEmit + vite build
Type check:  pnpm typecheck      # tsc --noEmit only
Lint:        pnpm lint
Format:      pnpm format:check
Test (unit): pnpm test           # vitest run
Test (e2e):  pnpm test:e2e       # playwright test
Dev server:  pnpm dev            # Vite only (UI)
Full dev:    pnpm tauri:dev      # Tauri + Vite (desktop app)
```

Run `pnpm build` and `pnpm test` after every change. Report any failures before marking a task complete.

---

## 8. Existing Codebase Notes

RaBIT has substantial existing code. Apply the following rules when working with it:

- Do NOT rewrite existing code to match spec structure retroactively
- For modifications to existing features: read all affected files first, then produce the Stage 1–2 spec scoped only to the change
- If existing code conflicts with a new requirement, surface the conflict — do not silently work around it
- Discovered patterns and conventions should be noted in `specs/_conventions.md`
- Check `.rabit-memory/bug-fix-history.md` before any debugging session; update it after every fix

---

## 9. Communication Protocol

- **Be direct.** No filler phrases ("Great question!", "Absolutely!").
- **Be honest about uncertainty.** If something was not verified, say so explicitly.
- **Ask when unclear.** Do not guess at ambiguous requirements — surface the question.
- **Surface blockers early.** Do not push through a broken approach hoping it resolves.
- **Summarize briefly.** End-of-task summaries: 2–3 sentences max unless asked for more.
- **Explain tradeoffs.** When making decisions, state what was chosen and why, and what was rejected.
- **After every build phase completes**, update `.rabit-memory/phase-tracker.md`.

---

## 10. Escalation Rules

Stop and ask for guidance when:
- A task requires modifying code outside the specified scope
- An approach has failed twice with the same root cause
- A requirement conflicts with the Architecture Principles
- A change could affect the `.rabit` file format or export behavior
- You are about to add a dependency, delete files, or modify Rust IPC / file I/O code

---

## 11. Protected UI Behaviors

These features are fully implemented and must NOT be removed, replaced, or silently altered without explicit user approval. Before modifying any listed file, re-read it fully and verify every row that references it is still intact after your change.

### Rules
1. **Read before touching.** Any edit to a file in the Location column requires reading that file first and verifying each relevant row is still intact afterward.
2. **Simplify skill — deletions require confirmation.** When `/simplify` or any refactor agent proposes removing code from a protected file, surface the specific items being removed and wait for approval before applying.
3. **Add as you build.** After implementing any new permanent user-visible behavior, add it to this table in the same session.

---

### Canvas Tools & Toolbar — `src/ui/toolbar/ToolBar.tsx`

| Feature | What must remain |
|---|---|
| Pencil tool button | `<button>` wired to tool `pencil`, shortcut `B` |
| Eraser tool button | `<button>` wired to tool `eraser`, shortcut `E` |
| Line tool button | `<button>` wired to tool `line`, shortcut `N` |
| Rectangle tool button | `<button>` wired to tool `rectangle`, shortcut `R` |
| Ellipse tool button | `<button>` wired to tool `ellipse`, shortcut `O` |
| Fill tool button | `<button>` wired to tool `fill`, shortcut `G` |
| Move tool button | `<button>` wired to tool `move`, shortcut `V` |
| Marquee tool button | `<button>` wired to tool `marquee`, shortcut `M` |
| Lasso tool button | `<button>` wired to tool `lasso`, shortcut `L` |
| Magic Wand tool button | `<button>` wired to tool `magic-wand`, shortcut `W` |
| Eyedropper tool button | `<button>` wired to tool `eyedropper`, shortcut `I` |
| Hand tool button | `<button>` wired to tool `hand`, shortcut `H` |
| Zoom tool button | `<button>` wired to tool `zoom`, shortcut `Z` |
| Pixel-perfect mode toggle | Toggle button, shortcut `P`, pencil/eraser only |
| Mirror Horizontal toggle | Toggle button, shortcut `Y` |
| Mirror Vertical toggle | Toggle button, shortcut `Shift+Y` |

---

### Canvas Interactions — `src/ui/canvas/useViewportInteraction.ts` + `CanvasViewport.tsx`

| Feature | What must remain |
|---|---|
| Pan — Space+drag | `isTypingTarget()` guard; `isSpaceDown` flag; pointer capture on Space |
| Pan — middle-click drag | `e.button === 1` branch in `onPointerDown` |
| Pan — Hand tool drag | `isHandActive` branch in `onPointerDown` |
| Zoom — Ctrl+scroll | `onWheel` with `e.ctrlKey` calling `snapZoom` |
| Zoom — Ctrl+= / Ctrl+- | `onKeyDown` keyboard handler calling `snapZoom` |
| Fit to window — Ctrl+0 | `fitToWindow()` call in keyboard handler |
| Space-in-input guard | `isTypingTarget()` — skips Space pan when focus is in `INPUT`/`TEXTAREA`/`contenteditable` |
| Reference image — Alt+drag | Alt+drag handler panning `useReferenceStore` position |
| Tile mode | `setEngineTileMode()` wired to `useUIStore.tileMode` |
| Mirror mode | `setEngineMirrorMode()` wired to `useToolStore.mirrorMode` |
| Onion skin compositing | `setOnionFrames()` logic in `CanvasViewport.tsx` |
| Grid overlay | `showGrid` state toggled from ViewMenu |
| Checkerboard overlay | `showCheckerboard` state toggled from ViewMenu |

---

### Layer Panel — `src/ui/panels/LayerPanel/LayerPanel.tsx` + `LayerRow.tsx`

| Feature | What must remain |
|---|---|
| Add layer button | `IconPlus` header button → `layerActions.addLayer()` |
| Delete layer button | Red trash icon (`styles.danger` class) → `layerActions.removeLayer()` |
| Duplicate layer button | Copy icon header button → `layerActions.duplicateLayer()` |
| Merge down button | Merge icon header button → `layerActions.mergeDown()` |
| Drag-to-reorder | Pointer-event drag on `listRef` container (NOT HTML5 DnD); `onListPointerDown/Move/Up`; `dragSrcRef` for immediate sync |
| Layer visibility toggle | Eye/EyeOff icon button → `setLayerVisibility()` |
| Layer lock toggle | Lock icon button → `setLayerLocked()` |
| Rename layer | Double-click name span → inline input → `renameLayer()` |
| Layer context menu | Right-click → **Rename, Duplicate layer, Merge down, Delete layer (danger)** |
| Multi-select | `Ctrl+click` toggle, `Shift+click` range in `handleRowSelect()` |
| Blend mode dropdown | Footer dropdown with Normal/Multiply/Screen/Overlay/Add/Subtract |
| Opacity slider | Footer range 0–100 → `setLayerOpacity()` |
| Layer thumbnail | `LayerThumbnail.tsx` — throttled canvas preview of this layer only |

---

### Timeline — `src/ui/panels/Timeline/Timeline.tsx` + `Timeline.module.css`

| Feature | What must remain |
|---|---|
| Playback: First/Prev/Play/Next/Last | All 5 transport buttons wired to `goTo*` / `setPlaying()` |
| Playback: keyboard `,` / `.` / `Enter` | Key handlers in `useEffect` |
| FPS input | Number input → `setFps()`, range 1–120 |
| Loop toggle | Checkbox → `setLoop()` |
| Onion skin toggle + before/after counts | Checkbox + two number inputs → `setOnionSkin()` |
| Add frame | `LuPlus` button → `frameActions.addFrame()` |
| Duplicate frame(s) | `LuCopy` button + `Ctrl+D` → `executeDuplicate()` |
| Frame selection | Click = navigate; Shift+click = range; Ctrl+click = toggle |
| Frame drag-to-reorder | Pointer capture on `frameGridRef`; `dragRef`; `frameActions.reorderFrame()` |
| Frame duplicate button | Hover-visible `LuCopy` on each frame header |
| Frame delete button | Hover-visible `LuX` on each frame header; hidden when only 1 frame |
| Frame cell thumbnails | `ThumbCell` renders **this layer only** (not full composite) |
| Linked cell indicator | `LuLink` icon in `FrameCell` |
| Add-frame placeholder cell | End-of-row `LuPlus` cell → `addFrameAtEnd()` |
| Layer lock in timeline | Lock icon button per layer row |
| Layer rename in timeline | Double-click → inline input → `renameLayer()` |
| Layer delete in timeline | Red `LuX` button per layer row (hidden until hover); disabled when only 1 layer |
| Layer context menu | Right-click → **Rename, Duplicate layer, Merge down, Delete layer (danger)** |
| Frame tags — create | Drag on tag row → `tagActions.createTag()` |
| Frame tags — rename | Double-click tag band → inline input → `tagActions.renameTag()` |
| Frame tags — delete | Right-click context menu → `tagActions.deleteTag()` |
| Vertical scroll sync | `layerLabelsListRef` + `frameRowsScrollRef` + `syncingScrollRef` mutex |
| Frame counter display | `activeFrameIndex + 1 / frames.length` in controls row |

---

### Color Picker Panel — `src/ui/panels/ColorPickerPanel/`

| Feature | File | What must remain |
|---|---|---|
| Primary / secondary color wells | `ColorWells.tsx` | Two swatch buttons; click secondary to swap active |
| Swap colors | `ColorWells.tsx` | Button + shortcut `X` → `swapColors()` |
| Reset colors | `ColorWells.tsx` | Button + shortcut `D` → `resetColors()` |
| Color history | `ColorHistory.tsx` | Row of recent color swatches |
| HSV intent refs | `HsvPicker.tsx` | `hRef/sRef/vRef` — MUST NOT be replaced with derived state |
| HSV SV square drag | `HsvPicker.tsx` | Pointer drag → `apply(h, s, v, a)` |
| Hue strip drag | `HsvPicker.tsx` | Pointer drag → `apply(newH, s, v, a)` |
| Alpha strip drag | `HsvPicker.tsx` | Pointer drag → `apply(h, s, v, newA)` |
| H / S / V / A number inputs | `HsvPicker.tsx` | Four `NumberInput` fields; H wraps 0–360 |
| Force-rerender when s=0 | `HsvPicker.tsx` | `forceRerender` state increment when `newPrimary === primary` |
| RGB inputs | `RgbPicker.tsx` | R / G / B / A number inputs |
| Hex input | `HexPicker.tsx` | `#RRGGBBAA` text input |
| Mode tabs | `ColorPickerPanel.tsx` | HSV / RGB / Hex tab buttons |

---

### Palette Panel — `src/ui/panels/PalettePanel/PalettePanel.tsx`

| Feature | What must remain |
|---|---|
| Swatch size toggle | S / M / L radio buttons → `--swatch-size` CSS var |
| Import palette | Upload icon button → file input accepting `.gpl .csv .txt .hex` |
| Add swatch | `IconPlus` button → `paletteActions.addSwatchFromPrimary()` |
| Click swatch to set primary | Each swatch `<button>` → `onPickPrimary()` |
| Drag-to-reorder swatches | Native HTML5 DnD on swatch buttons → `paletteActions.moveSwatch()` |
| Swatch context menu | Right-click → Set as primary, Set as secondary, Replace with primary, Rename…, Delete swatch |
| Swatch rename | Context menu → inline input → `paletteActions.renameSwatch()` |
| Grid right-click menu | Right-click empty grid area → **Replace palette from canvas, Append canvas colors to palette** |
| Empty-state tooltip | Tooltip on empty span: explains right-click for replace/append options |

---

### File Operations — `src/ui/menu/FileMenu.tsx` + `src/state/action-composers/file-actions.ts`

| Feature | Shortcut | What must remain |
|---|---|---|
| New project | `Ctrl+N` | Dialog with canvas size presets → `initNewProject()` |
| Open project | `Ctrl+O` | `fileActions.openProject()` |
| Save | `Ctrl+S` | `fileActions.saveProject()`; disabled when clean |
| Save As | `Ctrl+Shift+S` | `fileActions.saveProjectAs()` |
| Export | `Ctrl+E` | Opens `ExportDialog` |
| Recent files list | — | Shown in FileMenu; click → `openProjectAt()`; missing files show indicator |
| Clear recent files | — | Muted menu item → `clearRecentFiles()` |
| Add reference image | — | File dialog → `ipcLoadReferenceImage` |
| Auto-save | — | `writeAutoSave()` triggered by Tauri event `autosave:request` |
| Crash recovery dialog | — | `CrashRecoveryDialog` shown on startup if stale snapshot found |
| Unsaved changes guard | — | `confirmDiscardIfDirty()` before new/open/close; concurrent-call guard via `pendingDiscardResolver` |
| Window title sync | — | `syncWindowTitle()` — shows dirty `*` prefix and short path |

---

### Export Dialog — `src/ui/dialogs/ExportDialog.tsx`

| Feature | What must remain |
|---|---|
| PNG export tab | Mode (current/all frames), scale (1×–16×), background toggle, output dir picker |
| Spritesheet export tab | Layout (H/V/Grid), columns, padding, scale, background, sidecar JSON, output file picker |
| GIF export tab | Scale (1×–4×), loop count, dither toggle, output file picker |

---

### Edit Menu — `src/ui/menu/EditMenu.tsx`

| Feature | Shortcut | Precondition |
|---|---|---|
| Undo | `Ctrl+Z` | `canUndo()` |
| Redo | `Ctrl+Y` / `Ctrl+Shift+Z` | `canRedo()` |
| Select All | `Ctrl+A` | always |
| Deselect | `Ctrl+D` | `hasSelection` |
| Cut | `Ctrl+X` | `hasSelection` |
| Copy | `Ctrl+C` | `hasSelection` |
| Paste | `Ctrl+V` | `hasClipboard` |
| Delete selection | `Delete` | `hasSelection` |
| Invert selection | `Ctrl+I` | `hasSelection` |
| Flip Horizontal / Vertical | — | always |
| Rotate 90 CW / CCW | — | always |
| Outline Layer | — | always |
| Preferences | `Ctrl+,` | always |

---

### View Menu — `src/ui/menu/ViewMenu.tsx`

| Feature | Shortcut | What must remain |
|---|---|---|
| Toggle Tile Mode | `T` | Checked menu item → `useUIStore.setTileMode()` |
| Toggle Nine-Slice Preview | — | Checked menu item → `useUIStore.setNineSliceVisible()` |
| Toggle Grid | — | Checked menu item → `useUIStore.setShowGrid()` |
| Toggle Checkerboard | — | Checked menu item → `useUIStore.setShowCheckerboard()` |

---

### Reference Image Panel — `src/ui/panels/ReferencePanel/ReferencePanel.tsx`

| Feature | What must remain |
|---|---|
| Visible toggle | Checkbox → `setOpacity` or show/hide |
| Opacity slider | Range 0–100 |
| Change image button | Opens file dialog → loads via `ipcLoadReferenceImage` |
| Remove image button | → `useReferenceStore.clear()` |
| Alt+drag to reposition | Handled in `useViewportInteraction.ts` |

---

### Nine-Slice Panel — `src/ui/panels/NineSlicePanel/NineSlicePanel.tsx`

| Feature | What must remain |
|---|---|
| Top / Right / Bottom / Left margin sliders | Four range inputs clamped to canvas dimensions |
| Target width / height inputs | Number inputs 16–512px |
| Preview canvas | Live `drawNineSlice()` canvas render |
| Close button | × button → `setVisible(false)` |

---

### Preferences Dialog — `src/ui/dialogs/PrefsDialog.tsx`

| Feature | What must remain |
|---|---|
| UI Scale buttons | 0.9 / 1.0 / 1.25 selector |
| Auto-save interval | Number input (minutes) |
| Max undo stack | Number input |
| Default frame duration | Number input (ms) |
| Keybindings tab | Per-action key binding inputs for pencil, eraser, line, eyedropper, hand, zoom, swap colors, reset colors |
| Reset all button | → `ipcPrefsReset()` |

---

### Selection & Floating Selection — `src/core/tools/` + `src/state/action-composers/selectionActions.ts`

| Feature | What must remain |
|---|---|
| Marquee rectangular select | Drag creates rect selection; Shift constrains to square |
| Lasso freehand select | Click-point path; Enter / double-click closes |
| Magic Wand color select | Click → flood-select by color tolerance |
| Floating selection creation | Move tool drag inside selection lifts pixels to float |
| Floating selection commit | On tool switch or `Escape` → `commitFloatingSelection()` |
| Marching ants overlay | Canvas overlay rendered during float, driven by `selectionDragOffset` |
| Selection clipboard | `useToolStore.selectionClipboard` persists cut/copy data |
