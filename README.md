# RaBIT

**RaBIT** (Raster + Bit creation system) is a professional-grade desktop pixel art and sprite animation editor for indie game developers and digital artists. Positioned as a studio-grade Aseprite alternative with a modern, minimal UI (Figma/Blender feel).

**Status:** Pre-alpha - M0 scaffold. See [`docs/milestones.md`](docs/milestones.md) for the full 14-milestone build plan.

---

## Prerequisites

RaBIT requires a working Rust + Node toolchain plus Tauri 2's platform-specific prerequisites.

### Windows

1. **[Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)** — install the "Desktop development with C++" workload (~6GB). Required by Rust on Windows.
2. **[Rust](https://rustup.rs)** — run `rustup-init.exe`. Accept defaults. Installs `cargo`, `rustc`, `rustup`.
3. **WebView2 runtime** — pre-installed on Windows 10 (1803+) and 11. Otherwise install the evergreen runtime from Microsoft.
4. **Node 20 LTS or newer** — from [nodejs.org](https://nodejs.org).
5. **pnpm** — `npm install -g pnpm`. (Corepack is the "official" route, but hits signature-verification errors on some Node 20.16 installs — `Cannot find matching keyid`. The npm global install is the reliable path on Windows.)

### macOS

1. **Xcode Command Line Tools** — `xcode-select --install`.
2. **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.
3. **Node 20 LTS** — from [nodejs.org](https://nodejs.org) or `brew install node`.
4. **pnpm** — `corepack enable pnpm`.

### Linux (Ubuntu/Debian)

1. **System dependencies:**
   ```bash
   sudo apt update
   sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf build-essential curl wget file libssl-dev libayatana-appindicator3-dev
   ```
2. **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.
3. **Node 20 LTS** — via [nodesource](https://github.com/nodesource/distributions) or [nvm](https://github.com/nvm-sh/nvm).
4. **pnpm** — `corepack enable pnpm`.

Verify with:

```bash
node --version   # v20.x or v22.x
pnpm --version   # 9.x
cargo --version  # 1.77+
```

---

## First-time setup

```bash
pnpm install
```

This resolves frontend dependencies and creates `pnpm-lock.yaml`. Rust dependencies fetch on first `cargo build` or `pnpm tauri dev`.

---

## Development

```bash
pnpm tauri dev
```

Opens the Tauri app window with HMR. The first run takes several minutes (Rust + Tauri compile). Subsequent runs are fast.

For frontend-only work without the Tauri shell (useful for component dev):

```bash
pnpm dev
# Opens http://localhost:1420 in your browser — note: Tauri-specific IPC calls won't work here.
```

---

## Available scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Vite dev server only (no Tauri shell) |
| `pnpm tauri:dev` | Tauri dev window with HMR |
| `pnpm build` | Type-check + production build (frontend) |
| `pnpm tauri:build` | Full installer build (Windows `.msi`/`.exe`, macOS `.dmg`, Linux `.deb`/`.AppImage`) |
| `pnpm typecheck` | TypeScript check, no emit |
| `pnpm lint` | ESLint across the codebase |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check (CI) |
| `pnpm test` | Vitest unit tests |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright E2E tests |

For Rust-side checks, from `src-tauri/`:

```bash
cargo check                # type-check
cargo clippy -- -D warnings
cargo fmt --check
cargo test
```

---

## Project structure

```
src/                    TypeScript (frontend)
  ui/                   React components (UI Layer)
  state/                Zustand stores + action composers
  core/                 Editor core (tools, commands, data model)
  render/               WebGL2 rendering engine
  bridge/               Typed Tauri IPC wrappers
  styles/               tokens.css, resets, global styles
  assets/               Icons, fonts, cursors
src-tauri/              Rust backend
  src/
    main.rs             binary entry (delegates to lib.rs)
    lib.rs              Tauri Builder setup + run()
  tauri.conf.json       Tauri app configuration
  Cargo.toml
tests/
  e2e/                  Playwright tests
  fixtures/             Sample .rabit files, PNGs
docs/                   PRD, architecture, design system, stack, data model, milestones
.rabit-memory/          Project memory (decisions, risks, phase tracker)
```

**Layer import rules** (enforced by ESLint `no-restricted-paths`): see the `README.md` in each `src/*` subfolder, and architecture.md §4 for the full dependency graph.

---

## Documentation

Every architectural decision and product requirement is captured under `docs/`:

- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/architecture.md`](docs/architecture.md) — system layers, command system, rendering pipeline
- [`docs/design-system.md`](docs/design-system.md) — UI tokens, components, layout
- [`docs/stack.md`](docs/stack.md) — locked dependency versions and license audit
- [`docs/data-model.md`](docs/data-model.md) — in-memory types and `.rabit` binary format
- [`docs/milestones.md`](docs/milestones.md) — 14-milestone build plan

---

## License

*To be finalized before first public release.* RaBIT's own license is TBD; all dependencies are MIT or Apache-2.0 per the stack policy ([`docs/stack.md`](docs/stack.md) §6).
