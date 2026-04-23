---
name: RaBIT Stack Decision
description: Locked technical stack, version policy, and license compliance for RaBIT v1 (Phase 4 output)
type: project
---

Full rationale in `docs/stack.md`. This file captures load-bearing decisions and gotchas for future sessions.

## Locked Stack (do not re-litigate)

| Layer | Tech | Version |
|---|---|---|
| Desktop shell | Tauri | 2.x |
| Rust edition | 2021 | — |
| Node | LTS | 20.x or 22.x |
| Package manager | **pnpm** (not npm/yarn/bun) | 9.x |
| Frontend | React | 18.3.x (evaluate React 19 at first refactor) |
| Language | TypeScript | 5.5+ |
| State | Zustand 4 + Immer 10 | — |
| Build | Vite | 5.x |
| Rendering | WebGL2 + GLSL ES 3.00 | browser-provided |
| Testing | Vitest + Playwright + proptest | — |
| Lint | ESLint 9 (flat config) + clippy | — |
| Format | Prettier 3 + rustfmt | — |
| CSS | CSS Modules + custom properties (no CSS-in-JS, no Tailwind) | — |
| Fonts | Inter + JetBrains Mono (OFL, bundled WOFF2 subset) | — |

## Rust Crates (locked)

`tauri`, `serde`, `serde_json`, `rmp-serde` (MessagePack), `zstd`, `image`, `png`, `rayon`, `thiserror`, `anyhow`, `tracing`, `nanoid`, `proptest` (tests only).

## License Conflict: gifski (resolved)

**gifski is AGPL-3.0 — cannot be used in app core.** CLAUDE.md lists it; needs an update.

**Replacement:** `gif` crate (MIT) + `color_quant` (MIT) for GIF export. Quality lower than gifski but acceptable for pixel art (small palettes). GIF export is P1, no immediate blocker.

**Why:** "All deps must be MIT or Apache-2.0 — no GPL in the app core" per CLAUDE.md. AGPL forces source availability on linking.

**How to apply:** When GIF export is implemented (Phase 7 P1), use `gif` + `color_quant`. Do NOT add `gifski` to `Cargo.toml`. Update CLAUDE.md §"Confirmed Stack" in a follow-up to remove gifski reference.

## Pinning Policy

- Tauri/React/Rust toolchain: pin exact minor (`^2.1.0`)
- Build tools: caret-major allowed
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`) committed; `--frozen-lockfile` in CI
- `cargo audit` + `pnpm audit` in CI

## Key Rejected Options (with reason, so we don't revisit)

- **Electron** — bundle size + memory (architecture §14)
- **Redux** — Zustand sufficient (architecture §14)
- **wgpu** — overkill for 2D; WebGL2 → WebGPU is the natural path instead (architecture §14)
- **Three.js / PixiJS** — overkill for 2D compositing; would fight abstractions
- **Bun** — faster but Tauri/Vite ecosystem compat uneven in 2026
- **Biome** — faster than ESLint+Prettier but `no-restricted-paths` support insufficient for our layered import rules
- **Radix UI / shadcn / HeadlessUI** — our design system is dense + dark-tool; we'd override everything
- **Tailwind** — design-system.md locks CSS Modules + tokens
- **SQLite** — no persistent DB needed; `.rabit` + JSON preferences are enough
- **HTTP client** — offline-only constraint (see security.md)

## Workspace Layout

Single-package project (not a pnpm workspace). `src/` for TS, `src-tauri/` for Rust. Revisit workspace split only if a shared-types crate emerges.

## Load-bearing enforcement

`no-restricted-paths` ESLint rule enforces architecture §4 "no upward imports":
- `src/ui/**` cannot import from `src/core/**` except through `src/state/**`
- `src/core/**` cannot import React
- `src/state/**` cannot import React components

Concrete rule set will be written in Phase 6 (milestones) or Phase 7 (implementation).

## React 18 vs 19 open question

Current decision: start on React 18.3.x per prior-phase approvals; migrate to 19 at first major refactor milestone. If Phase 5/6 identifies a React 19-only feature we need (Compiler, Actions, `use()`), reopen this.

**How to apply:** Don't silently upgrade. If tempted, flag as a stack deviation first.
