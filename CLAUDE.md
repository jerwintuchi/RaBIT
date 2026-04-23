# RaBIT — Claude Code Project Context

RaBIT (Raster + Bit creation system) is a professional-grade desktop pixel art and sprite animation editor. Target users: indie game developers and digital artists. Positioned as a studio-grade Aseprite alternative with a modern, minimal UI (Figma/Blender feel — NOT retro/playful).

## Current Build Phase

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

**Always check `.rabit-memory/phase-tracker.md` for the latest phase status.**

## Key Documents (read these before working on any phase)

- `docs/PRD.md` — full product requirements, feature priority matrix (P0/P1/P2), personas, NFRs
- `docs/architecture.md` — system layers, module dependency graph, command system, rendering pipeline
- `.rabit-memory/MEMORY.md` — memory index (decisions, risks, design notes)

## Confirmed Stack (Phase 4 will formalize this)

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
  - `simplify` → after implementing any module
  - `security-review` → before any release checkpoint; after Rust IPC / file I/O work
  - `anthropic-skills:skill-creator` → when a recurring RaBIT workflow needs a dedicated skill
  - `anthropic-skills:consolidate-memory` → when `.rabit-memory/` grows redundant
- **Custom skills** to create before Phase 7: `rabit-module-scaffold`, `rabit-rust-command`, `rabit-shader`, `rabit-release-check`

## Response Style Preferences

- Explain tradeoffs when making decisions — don't just pick one
- Explain approach before writing code
- Always explain syntax and tradeoffs — not just the code itself
- Never hallucinate — check docs/ and .rabit-memory/ before making claims
- After every phase, update `.rabit-memory/phase-tracker.md`
