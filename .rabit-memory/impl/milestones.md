---
name: Implementation Milestones
description: 14-milestone build plan for RaBIT v1.0 (Phase 6 output) — sequencing, sizes, dependencies
type: project
---

Full plan in `docs/milestones.md`. This file captures load-bearing sequencing decisions.

## Milestone Map

| # | Milestone | Size | Critical path? | Release |
|---|---|---|---|---|
| M0 | Project scaffold | M | ✓ | — |
| M1 | Design tokens + primitive components | M | — (parallel) | — |
| M2 | Editor core: types + stores + command system | M | — (parallel) | — |
| M3 | WebGL2 renderer foundation | L | ✓ | — |
| **M4** | **🚩 Walking skeleton: pencil end-to-end** | **L** | **✓ (most critical)** | **Alpha** |
| M5 | Remaining MVP drawing tools | M | — | — |
| M6 | Layer panel + ops | M | — | — |
| M7 | Color + palette panels | M | — (parallel after M1) | — |
| M8 | Frames + timeline + animation + onion | L | ✓ | — |
| M9 | File I/O: save/open `.rabit` | M | — (parallel after M2) | — |
| M10 | Auto-save + crash recovery | S | — | — |
| M11 | PNG + spritesheet export | M | — | Beta |
| M12 | Preferences + keybindings | S | — | — |
| **M13** | **🚩 Polish, perf audit, security review** | **L** | **✓** | **v1.0 RC** |
| M14+ | Post-MVP (selection P1, GIF P1, plugins P2) | — | — | — |

**Critical path:** M0 → M3 → M4 → M8 → M13. Anything else is parallelizable with a second developer.

## Why M4 Is The Most Important Milestone

M4 is the first moment the entire stack is proven: UI → State → Core → Rendering → Command → Undo. Every later milestone is a variation on the pattern M4 establishes. If M4 is shaky, M5–M13 will all be shaky.

**How to apply:** If asked "how's the project going?" at any point — M4 status is the answer that matters. Features before M4 are scaffolding; features after M4 are compounding.

## Scope Lock — What's NOT in v1

Deferred to M14+ or v2:

- Selection tools (P1): Marquee, Lasso, Magic Wand
- GIF export (P1): uses `gif` + `color_quant` NOT gifski
- Plugin system (P2): requires separate design pass for security
- Indexed color mode (v2)
- Per-cell bounding boxes (v2)
- WebGPU migration (v2)
- Layer folders/groups (not in PRD)
- Animation ease curves (not in PRD)

**Why locked:** scope creep is the top risk (see milestones.md §6). Every "just one more X" in MVP scope pushes v1.0 release out and compounds maintenance.

**How to apply:** A feature request during Phase 7 that's not in the milestone plan gets filed to a P1 backlog, not added inline. Exceptions require explicit PRD update.

## Cross-Milestone Invariants (always hold)

- `no-restricted-paths` ESLint rule passes (no upward imports)
- No React in `src/core/` or `src/state/`
- No `std::fs::write` outside `fs_sandbox`
- Every canvas mutation via CommandSystem
- No CSS-in-JS, no Tailwind
- Canvas ≥ 60fps at 1080p up to 4096×4096
- Tool response < 16ms
- No network calls in shipping binary
- `cargo audit` + `pnpm audit` clean in CI

## Per-Milestone Tracking Convention

When a milestone starts, create `.rabit-memory/impl/m{N}.md` with:
- Entry date, completion date
- Exit criteria checkboxes
- Deviations from plan (with why)
- Surprises / learnings
- Follow-up work spawned

At M13 done, these files become the v1.0 build history.

## Estimation Reality Check

~15–22 weeks for a single focused developer. Anything faster suggests corner-cutting; anything much slower suggests scope drift or architectural friction. Revisit the plan if we're 3+ weeks off trajectory for any milestone.

## Known Risks (top 3)

1. **Scope creep** — highest likelihood, highest impact. Mitigate with a hard P1 backlog.
2. **WebGL2 + Tauri WebView inconsistency across OSes** — medium likelihood, high impact. Mitigate with cross-OS testing starting at M3, not M13.
3. **Delta undo memory on unusual workloads** — profile at M4 with synthetic stress tests before compounding in later milestones.
