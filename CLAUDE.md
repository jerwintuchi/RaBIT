# RaBIT — Claude Code Project Context

RaBIT (Raster + Bit creation system) is a professional-grade desktop pixel art and sprite animation editor. Target users: indie game developers and digital artists. Positioned as a studio-grade Aseprite alternative with a modern, minimal UI (Figma/Blender feel — NOT retro/playful).

## Current Build Phase

**Always check `.rabit-memory/phase-tracker.md` for the latest phase status.**

| Phase | Title | Status | Output |
|---|---|---|---|
| 1 | Product Requirements Document | ✅ Done | `docs/PRD.md` |
| 2 | System Architecture Design | ✅ Done | `docs/architecture.md` |
| 3 | UI/UX Design System | 🔜 Next | `docs/design-system.md` |
| 4 | Technical Stack Decision | ⏳ | `docs/stack.md` |
| 5 | Data Model + File Format | ⏳ | `docs/data-model.md` |
| 6 | Implementation Plan / Milestones | ⏳ | `docs/milestones.md` |
| 7 | Core Implementation | ⏳ | `src/` |
| 8 | Optimization + Refactoring | ⏳ | — |

## Key Documents (read these before working on any phase)

- `docs/PRD.md` — full product requirements, feature priority matrix (P0/P1/P2), personas, NFRs
- `docs/architecture.md` — system layers, module dependency graph, command system, rendering pipeline
- `.rabit-memory/MEMORY.md` — memory index (decisions, risks, design notes)

## Confirmed Stack

| Layer | Technology |
|---|---|
| Desktop shell | **Tauri** (Rust backend) |
| UI framework | **React 18 + TypeScript** |
| Canvas renderer | **WebGL2** (custom, no Three.js) |
| State management | **Zustand + Immer** |
| Build tool | **Vite** |
| Testing | **Vitest** (unit) + **Playwright** (E2E) |
| Rust crates | serde, rmp-serde, zstd, image, png, rayon, gif + color_quant (P1 GIF export) |

## Architecture Principles (non-negotiable)

1. **No upward imports.** Dependency direction: `UI → State → Editor Core → Tauri IPC → Rust`. Never reverse this.
2. **Every canvas mutation is a Command.** No direct pixel writes outside the command system. This is how undo/redo works.
3. **Delta-based undo.** Store only changed pixels per operation, not full canvas snapshots. Required for 4K canvas memory budget.
4. **GPU renders, Rust writes files, TypeScript orchestrates.** Never do file I/O in JavaScript. Never block the UI thread.
5. **Stroke preview on scratchBuffer (GPU only).** Only committed to undo stack on `pointerUp`.
6. **Atomic file writes.** Write → `.rabit.tmp` → checksum verify → OS rename. Never overwrite `.rabit` in place.

## MVP Feature Scope (P0 — build these first)

Canvas editor (up to 4096×4096), pencil/eraser/fill/line tools, layer system, frame animation + timeline, onion skinning, RGBA color palette, unlimited delta-based undo/redo, PNG + spritesheet export, `.rabit` project format, keyboard shortcuts.

**Not in MVP:** GIF export (P1), selection tools (P1), plugin system (P2). Do not build ahead of P0.

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
  - `simplify` → after implementing any module; **before applying any deletion it proposes, check it against Section 11 (Protected UI Behaviors) and confirm with the user**
  - `security-review` → before any release checkpoint; after Rust IPC / file I/O work
  - `anthropic-skills:skill-creator` → when a recurring RaBIT workflow needs a dedicated skill
  - `anthropic-skills:consolidate-memory` → when `.rabit-memory/` grows redundant
- **Custom skills** to create before Phase 7: `rabit-module-scaffold`, `rabit-rust-command`, `rabit-shader`, `rabit-release-check`

---

# Project Operating Manual

> This governs how AI assistants work on this project. Read it fully before making any changes.

---

## 1. Project Context

**Project name:** RaBIT (Raster + Bit creation system)
**Purpose:** Professional-grade desktop pixel art and sprite animation editor for indie game developers and digital artists
**Status:** Active development (Phase 7 — Core Implementation underway)
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

RaBIT has substantial existing code that predates this spec workflow. Apply the following rules when working with it:

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

These features exist and must NOT be removed, replaced, or silently altered without explicit user approval. Before modifying any file listed here, re-read it fully and confirm every item in this table is still present after your change.

| Feature | Location | What must remain |
|---|---|---|
| Layer context menu | `LayerRow.tsx` | Rename, Duplicate layer, Merge down, Delete layer (danger) |
| Layer context menu | `Timeline.tsx` | Rename, Duplicate layer, Merge down, Delete layer (danger) |
| Layer delete button | `Timeline.tsx` | Inline red ✕ button on each layer label row, hidden until hover |
| Layer delete button | `LayerPanel.tsx` | Red trash icon in panel header toolbar |
| Palette context menu (grid) | `PalettePanel.tsx` | Replace palette from canvas, Append canvas colors to palette |
| Palette empty-state tooltip | `PalettePanel.tsx` | Tooltip on empty grid area explaining right-click options |
| Frame context menu | `Timeline.tsx` | Duplicate frame, Delete frame buttons on each frame header |
| HSV spinner intent refs | `HsvPicker.tsx` | `hRef/sRef/vRef` pattern — do not replace with derived state |
| Viewport Space-pan guard | `useViewportInteraction.ts` | `isTypingTarget()` check — must skip Space handler in inputs |
| Layer drag reorder | `LayerPanel.tsx` | Pointer-event drag on list container (NOT HTML5 DnD) |
| Timeline scroll sync | `Timeline.tsx` | `layerLabelsListRef` / `frameRowsScrollRef` synchronized scroll |

### Rules for this section

1. **Read before touching.** Any edit to a file in the Location column requires reading that file first and verifying each row that references it is still intact after the change.
2. **Simplify skill — deletions require confirmation.** When `/simplify` or any refactor agent proposes removing code from a protected file, surface the specific items being removed and wait for approval before applying.
3. **Adding to this table.** After implementing any new user-visible behavior that should be permanent, add it here in the same session. Do not wait.
