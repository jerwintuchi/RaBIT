# RaBIT — Technical Stack Decision
**Version:** 1.0
**Date:** 2026-04-19
**Status:** Approved for Data Model Phase

---

## 1. Purpose of This Document

Phase 2 (architecture) named the high-level technologies (Tauri, React, WebGL2, Zustand, Vite). Phase 4 **locks exact versions, resolves every remaining toolchain decision, and audits every dependency for license compliance**. After this phase, no stack discussion should reopen — only version bumps within the pinned major.

Tradeoff framing: architecture.md §14 already justified Tauri vs Electron, WebGL2 vs wgpu, Zustand vs Redux, delta vs snapshot undo. This document does not re-litigate those — it assumes them and fills in the details.

---

## 2. Security & Distribution Constraints (locked)

RaBIT is **offline-only for v1**. This is a load-bearing constraint that shapes the stack:

- No HTTP client dependency in production binary (no `reqwest`, no `ureq`, no `fetch` calls)
- No telemetry / analytics SDK
- No auto-update infrastructure in MVP (manual download + install only)
- No online palette libraries (Lospec, etc.) in MVP
- No crash reporting service — crashes write to a local log only
- Plugin system is P2 — when added later, it will be a major security boundary and require its own design pass

**Implication:** Attack surface is purely local files + Tauri IPC. Threat model reduces to:
1. Malicious `.rabit` / `.png` / palette files exploiting parser bugs
2. Path traversal in export paths
3. Untrusted-data pivots through the Tauri IPC surface

See architecture.md §10 (IPC) and §11 (FS sandbox). `/security-review` will be run before each release, starting once the Rust deserializer lands in Phase 7.

---

## 3. Locked Stack

### 3.1 Desktop Shell & Language Toolchain

| Item | Choice | Version | License |
|---|---|---|---|
| Desktop shell | **Tauri** | `2.x` (latest stable at Phase 7 start) | MIT OR Apache-2.0 |
| Rust edition | **2021** | — | — |
| Rust toolchain | stable | pinned via `rust-toolchain.toml` | — |
| Node.js | **LTS** | 20.x or 22.x (current LTS at Phase 7 start) | MIT |
| Package manager | **pnpm** | 9.x | MIT |

**Why pnpm over npm/yarn/bun:**
- pnpm's content-addressable store shaves disk and install time noticeably on Tauri projects (Rust + Node dependencies both large)
- Strict `node_modules` layout catches accidental phantom dependencies — matches our "no upward imports" philosophy
- Mature (since 2017), used by Vite, Vue, Prisma, etc.
- Bun was considered and rejected for v1: faster, but tooling compat in the Tauri/Vite ecosystem is still uneven. Revisit for v2.

**Why Rust 2021 over 2024:**
- 2024 edition introduces syntax changes that a few dependencies haven't adopted yet
- No 2024-exclusive feature we need
- Revisit when `cargo --edition 2024` becomes the default project template

### 3.2 Frontend

| Item | Choice | Version | License |
|---|---|---|---|
| UI framework | **React** | `18.3.x` | MIT |
| Language | **TypeScript** | `5.5+` | Apache-2.0 |
| Build tool | **Vite** | `5.x` | MIT |
| State — core | **Zustand** | `4.x` | MIT |
| State — immutability | **Immer** | `10.x` | MIT |
| ID generation | **nanoid** | `5.x` | MIT |
| Virtualization | **react-window** | `1.8.x` | MIT |

**React 18 vs React 19 (tradeoff, decision deferred):**
- React 19 is stable as of Dec 2024 and the ecosystem has caught up. Compiler + Actions + `use()` hook are genuinely useful.
- Zustand 4.x works on React 19. react-window works on React 19.
- **Recommendation:** start Phase 7 on React 18.3.x (matches PRD/architecture approval), evaluate upgrading to 19 at the first major refactor milestone. The migration is mostly mechanical and the breaking changes are well-documented.
- **Not doing now:** jumping to 19 before Phase 7 begins would invalidate prior phase approvals without a concrete benefit in the MVP scope.

**No UI component library.** We build our own primitives per design-system.md. Candidates considered and rejected:
- **Radix UI** — excellent accessibility, but adds 40+ dependencies and doesn't match the dense dark-tool density we want. We'd override every style anyway.
- **shadcn/ui** — copy-paste model is appealing but opinionated toward consumer apps.
- **HeadlessUI** — Tailwind-adjacent, less used outside that ecosystem.

### 3.3 Rendering

| Item | Choice | Version | License |
|---|---|---|---|
| Graphics API | **WebGL2** | browser-provided (WebView2 / WKWebView / WebKitGTK) | — |
| Shader language | **GLSL ES 3.00** | — | — |
| Math helpers (optional) | **gl-matrix** | `3.x` | MIT |

No Three.js, no PixiJS, no Babylon. These are overkill for 2D compositing and would force us to fight their abstractions for the scratchBuffer / onion skin / selection marquee pipeline described in architecture.md §6.

**WebGPU migration path (post-MVP):** WebView2 and WebKit both have stable WebGPU now. Migration plan is in a dedicated tech-debt memory when we're ready — deferred to v2.

### 3.4 Rust Backend Crates

| Crate | Purpose | Version target | License |
|---|---|---|---|
| `tauri` | Desktop shell framework | `2.x` | MIT OR Apache-2.0 |
| `serde` | Serialization framework | `1.x` | MIT OR Apache-2.0 |
| `serde_json` | JSON IPC payloads | `1.x` | MIT OR Apache-2.0 |
| `rmp-serde` | MessagePack (for `.rabit` binary format) | `1.x` | MIT |
| `zstd` | Project file compression | `0.13+` | MIT OR Apache-2.0 (bindings); BSD-3-Clause (upstream zstd) |
| `image` | PNG encode/decode, pixel buffer helpers | `0.25+` | MIT OR Apache-2.0 |
| `png` | Direct PNG encoding (lower-level) | `0.17+` | MIT OR Apache-2.0 |
| `rayon` | Parallel iteration (flood fill, export packing) | `1.x` | MIT OR Apache-2.0 |
| `thiserror` | Error type ergonomics | `1.x` | MIT OR Apache-2.0 |
| `anyhow` | Error propagation in app-level code | `1.x` | MIT OR Apache-2.0 |
| `tracing` | Structured logging | `0.1.x` | MIT |
| `nanoid` | Command IDs (optional; serde-compat with TS side) | `0.4.x` | MIT |

### 3.5 ⚠️ GIF Export: License Conflict with CLAUDE.md

CLAUDE.md currently lists `gifski` under Rust crates. **This is a problem:**

- `gifski` is licensed **AGPL-3.0**. This violates the "no GPL in app core" constraint.
- AGPL imposes source-availability requirements even on linking, which would force RaBIT to ship as AGPL.

**Options, in order of preference:**

1. **Use `gif` crate (MIT) instead.** Pure-Rust GIF encoder. Quality is lower than gifski (gifski does perceptual color quantization). We'd pair it with a separate quantizer like `color_quant` (MIT) or `imagequant` (GPL-3 — also unusable ❌) or our own neuquant port. Simplest compliant path: `gif` + `color_quant`. Acceptable quality for pixel art since palettes are typically small.
2. **Shell out to external `gifsicle` binary.** GPL-2.0-licensed but distributed separately (user installs it themselves OR we don't bundle). Moves license boundary outside our binary.
3. **Write our own LZW encoder.** Non-trivial but patent issues are gone (LZW expired 2003/2004 per PRD). Rejected as a time sink — GIF export is P1, not MVP.

**Decision:** **Replace `gifski` with `gif` + `color_quant` in the locked stack.** GIF export is P1 (not MVP) — we have time to design the encoder properly. CLAUDE.md should be updated to reflect this in a follow-up.

**Action item:** update CLAUDE.md §"Confirmed Stack" to drop `gifski` and add `gif`, `color_quant`.

### 3.6 Testing

| Item | Choice | Version | License |
|---|---|---|---|
| Unit tests (TS) | **Vitest** | `2.x` | MIT |
| E2E tests | **Playwright** | `1.45+` | Apache-2.0 |
| DOM testing utilities | **@testing-library/react** | `16.x` | MIT |
| User event simulation | **@testing-library/user-event** | `14.x` | MIT |
| Rust tests | **cargo test** (built-in) | — | — |
| Property tests (Rust) | **proptest** (for file format fuzzing) | `1.x` | MIT OR Apache-2.0 |

Playwright drives the Tauri app through its dev-server URL in CI. For true end-to-end against the built binary, we use Tauri's WebDriver support (tauri-driver) added as needed.

**Why Vitest over Jest:** faster (Vite-native), ESM-first, no transform config hell. Jest was considered; rejected — Vitest is strictly better for a Vite project in 2026.

### 3.7 Linting & Formatting

| Item | Choice | Version | License |
|---|---|---|---|
| TS/JS linter | **ESLint** | `9.x` (flat config) | MIT |
| TS plugin | **typescript-eslint** | `8.x` | MIT |
| TS/JS formatter | **Prettier** | `3.x` | MIT |
| Import path enforcement | **eslint-plugin-import** with `no-restricted-paths` | latest | MIT |
| Rust linter | **clippy** (bundled with rustup) | stable | MIT OR Apache-2.0 |
| Rust formatter | **rustfmt** (bundled with rustup) | stable | MIT OR Apache-2.0 |

**Biome was considered and rejected.** It's fast and combines linter+formatter, but ecosystem support for ESLint rules we need (especially `no-restricted-paths` for the layered architecture) is still partial. Revisit in v2.

`no-restricted-paths` is the concrete mechanism that enforces "no upward imports" from architecture.md §4. Concrete rule set lives in `.eslintrc` — written in Phase 6.

### 3.8 CSS & Styling

| Item | Choice | License |
|---|---|---|
| Styling mechanism | **CSS Modules** (via Vite built-in) | — |
| Design tokens | CSS custom properties in `src/styles/tokens.css` | — |
| PostCSS plugins | **autoprefixer** only | MIT |
| No CSS-in-JS | — | — |
| No utility framework (no Tailwind) | — | — |

Rationale was locked in design-system.md §12. Vite + CSS Modules is faster at build and avoids runtime style injection latency.

### 3.9 Fonts

Bundled in-binary (WOFF2, subset to used Latin glyphs + common symbols):

| Font | License | Source |
|---|---|---|
| **Inter** | SIL OFL 1.1 | https://rsms.me/inter |
| **JetBrains Mono** | SIL OFL 1.1 | https://www.jetbrains.com/lp/mono |

**SIL OFL is compatible with our app core** (it's a permissive font license, not a code license). OFL permits bundling, embedding, and redistribution. Fonts are not linked into Rust — they're asset files.

Subset to keep binary small:
- Inter: U+0020–U+007F (ASCII) + U+00A0–U+00FF (Latin-1) + arrows + check/cross symbols (~8KB per weight)
- JetBrains Mono: U+0020–U+007F only (~5KB)

---

## 4. Project Workspace Layout

```
RaBIT/
├── src/                     ← TypeScript (React UI + editor core)
│   ├── ui/                  ← React components (UI Layer per architecture §3)
│   ├── state/               ← Zustand stores (State Layer)
│   ├── core/                ← Editor Core (tools, commands, selection)
│   ├── render/              ← WebGL2 rendering engine
│   ├── bridge/              ← Tauri IPC wrappers (typed)
│   ├── styles/              ← tokens.css, resets
│   └── assets/              ← icons (SVGR), fonts (WOFF2), cursors (PNG)
├── src-tauri/               ← Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── project_io/      ← .rabit serialize / deserialize
│   │   ├── export/          ← PNG, spritesheet, (later) GIF
│   │   ├── flood_fill/
│   │   ├── auto_save/
│   │   ├── crash_recovery/
│   │   └── fs_sandbox/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/
│   ├── e2e/                 ← Playwright
│   └── fixtures/            ← sample .rabit files, PNGs
├── docs/                    ← PRD, architecture, design-system, stack (this file)
├── .rabit-memory/           ← project memory
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
└── rust-toolchain.toml
```

The single-workspace layout (not a pnpm workspace / multi-package) is deliberate: v1 scope doesn't justify multi-package overhead. Revisit if we split a shared types library.

---

## 5. Version Pinning Strategy

| Dependency class | Policy |
|---|---|
| Tauri, React, Rust toolchain | Pin exact minor (`^2.1.0`, `^18.3.0`) — avoid surprise majors |
| Build tools (Vite, TypeScript, ESLint) | Caret-major (`^5.0.0`) — allow minor/patch updates |
| Rust crates | Caret-default via `cargo` (`^1.0`) — review `cargo update` monthly |
| TS deps | Exact-version via pnpm lockfile (`pnpm-lock.yaml` committed) |
| Fonts | Vendored WOFF2 files in `src/assets/fonts/` with source + license noted |

**Dependency review cadence:** monthly `pnpm outdated` / `cargo outdated` audit, noted in changelog.

**Supply-chain guards:**
- `pnpm-lock.yaml` committed; `--frozen-lockfile` in CI
- `cargo audit` in CI for known vulnerabilities
- `pnpm audit` in CI (accept filtered list of non-applicable advisories)

---

## 6. License Compliance Audit Summary

| Category | Policy | Status |
|---|---|---|
| App core dependencies (linked into shipped binary) | MIT / Apache-2.0 / BSD-3-Clause only | ✅ Full audit complete for v1 stack |
| Fonts | OFL 1.1 acceptable (permissive font license) | ✅ |
| GPL / AGPL / LGPL | **Forbidden in app core** | ⚠️ `gifski` was listed in CLAUDE.md; replaced with `gif` + `color_quant` above |
| Assets (icons, cursors) | Original work, or CC0 / MIT | To be verified in Phase 7 |
| External binaries (user-installed) | Any license OK | — |

Every dependency in §3 passes the policy except the flagged gifski replacement.

---

## 7. CI/CD Minimal Plan (Phase 7 will elaborate)

For v1, CI consists of:

1. **On PR:** lint + type-check + unit tests + `cargo check --all-targets` + `cargo clippy -- -D warnings` + `cargo fmt --check`
2. **On main:** the above + E2E tests (Playwright against dev server) + `cargo audit` + `pnpm audit`
3. **On tagged release:** Tauri build for Windows (MSI + NSIS), macOS (DMG, universal binary), Linux (AppImage + deb) — signed where certificates available

No deploy step — distribution is manual download from releases page until P2 (auto-update).

Recommended runner: **GitHub Actions**. Justified by ecosystem familiarity and free tier for public repos; alternatives (Cirrus, GitLab CI) are viable but not clearly better for this scope.

---

## 8. What's Explicitly Not in the Stack

These are called out so future tasks don't accidentally reopen them:

| Excluded | Reason |
|---|---|
| Electron | Architecture §14 — bundle size + memory budget |
| Redux / Redux Toolkit | Architecture §14 — Zustand is sufficient |
| Three.js / PixiJS / Babylon | Section 3.3 — overkill for 2D compositing |
| Tailwind / any utility CSS | Design-system §12 — CSS Modules + tokens |
| Any UI component library | Section 3.2 — we match our design system ourselves |
| gifski | License conflict (Section 3.5) |
| SQLite / any database | No persistent local DB needed — `.rabit` files + preferences JSON |
| Web Workers (for v1) | Rust backend handles CPU-heavy work; revisit if TS-side work emerges |
| Service Worker / PWA features | Not applicable — desktop app |
| HTTP client / fetch | Offline-only constraint (Section 2) |
| Auto-updater | Deferred to post-MVP |

---

## 9. Upgrade & Migration Paths

| From | To | Trigger | Effort estimate |
|---|---|---|---|
| React 18 | React 19 | First major refactor milestone | Low — mostly mechanical |
| WebGL2 | WebGPU | v2 scope, after WebView WebGPU reaches all target OS versions | Medium — shader rewrite (WGSL), pipeline model shift |
| pnpm | — | Stay unless pnpm declines | — |
| Rust 2021 | Rust 2024 | When default in new projects | Low — one-time `cargo fix --edition` |
| Tauri 2.x | Tauri 3.x (hypothetical) | Only when current version EOLs | Unknown — version doesn't exist yet |

---

## 10. Summary Table (single reference)

| Layer | Technology | Why (one-liner) |
|---|---|---|
| Desktop shell | Tauri 2 (Rust) | Small binary, low memory, safe IPC surface |
| Language (backend) | Rust 2021 | Memory safety for file parsing; fearless concurrency for export |
| Language (frontend) | TypeScript 5.5+ | Type safety across a layered app |
| UI | React 18 | Mature, ecosystem-compatible, concurrent features |
| State | Zustand 4 + Immer 10 | Minimal boilerplate, fine-grained subscriptions |
| Rendering | WebGL2 + GLSL ES 3.00 | GPU compositing without native-window complexity |
| Build | Vite 5 | Fast dev server, first-class ESM, excellent DX |
| Package mgr | pnpm 9 | Disk-efficient, strict module boundaries |
| Testing | Vitest + Playwright + proptest | Unit/E2E/property-based coverage |
| Lint/format | ESLint 9 + Prettier 3 / clippy + rustfmt | Path-import enforcement + consistent style |
| CSS | CSS Modules + custom properties | Zero runtime overhead, tokens-first |
| Fonts | Inter + JetBrains Mono (OFL, bundled) | Cross-OS consistency, professional density |

---

*End of Stack Decision v1.0*
