# RaBIT

**RaBIT** (Raster + Bit creation system) is a professional-grade desktop pixel art and sprite animation editor built for indie game developers and digital artists. It targets the same workflow as Aseprite with a modern, minimal interface — closer to Figma or Blender than to retro tooling.

Built on Tauri + React + WebGL2. Dark-first. Keyboard-driven. No subscriptions.

**Current status:** Feature-complete through M16 — layer groups, full animation timeline, export pipeline, and selection system all shipped. V2 features (custom brushes, indexed color, spritesheet import) in spec.

---

## Features

### Canvas & Tools
- **WebGL2 rendering** — 60 fps at all zoom levels up to 4096 × 4096
- **14 tools** — Pencil, Eraser, Fill, Line, Rectangle, Ellipse, Move, Marquee, Lasso, Magic Wand, Eyedropper, Hand, Zoom, Brush
- **Pixel-perfect mode** — eliminates diagonal over-draws (toggle `P`)
- **Mirror drawing** — horizontal (`Y`) and vertical (`Shift+Y`) axis mirroring
- **Tile mode** — 3 × 3 seamless tile preview while painting (`T`)
- **Reference image** — overlay any PNG/JPG, adjustable opacity, repositionable with `Alt+drag`

### Layers
- **Unlimited layers** with per-layer visibility, lock, opacity, and blend mode
- **Layer groups** — folder layers with collapse/expand; children composited as a unit via a dedicated WebGL FBO pass
- **Per-frame layer visibility** — hide specific layers on individual frames without deleting them
- **Drag-to-reorder** — pointer-capture drag with a live drop indicator; hover the bottom half of a group header to drop inside it
- **Blend modes** — Normal, Multiply, Screen, Overlay, Add, Subtract
- **Layer FX** — non-destructive outline effect, undoable
- **Merge down**, duplicate, cascade-delete groups — all fully undoable

### Animation
- **Frame-based timeline** with per-frame duration
- **Transport controls** — First / Prev / Play / Next / Last; keyboard `,` / `.` / `Enter`
- **Onion skinning** — configurable prev/next frame count, tinted overlays
- **Frame tags** — named ranges draggable directly on the timeline tag row
- **Linked cells** — shared pixel data across frames to save memory
- **Frame drag-to-reorder** — same pointer-capture pattern as the layer panel

### Color
- **RGBA palette** — import `.gpl`, `.csv`, `.txt`, `.hex`; drag-reorder swatches; palette-from-canvas (replace or append)
- **Color picker** — HSV square + hue strip + alpha strip; RGB inputs; hex input; color history row
- **Primary / secondary wells** — swap with `X`, reset with `D`

### Selection
- **Marquee** (rectangular), **Lasso** (freehand polygon), **Magic Wand** (flood-fill by tolerance)
- **Floating selection** — cut/lift pixels to a float layer, repositionable, committed on tool switch or `Escape`
- **Select All** (`Ctrl+A`), Deselect, Invert, Cut, Copy, Paste

### File & Export
- **`.rabit` project format** — MessagePack + zstd, atomic write (`→ .tmp → checksum → rename`)
- **Auto-save** — configurable interval, crash-recovery dialog on next launch
- **PNG export** — current frame or all frames, 1×–16× scale, optional background fill
- **Spritesheet export** — horizontal / vertical / grid layout, configurable padding and columns, sidecar JSON
- **GIF export** — 1×–4× scale, loop count, optional dithering
- **Recent files** list with missing-file indicator
- **Unsaved-changes guard** — shown before New, Open, and window close

### Nine-Slice Preview
- Live preview panel with adjustable top/right/bottom/left margins and target size
- Rendered directly from the current frame composite

### Undo / Redo
- **Unlimited delta-based undo** — stores only changed pixels per operation, not full snapshots
- Every tool stroke, layer operation, palette change, and canvas resize is a single undoable command
- Configurable stack depth in Preferences

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| UI framework | React 18 + TypeScript |
| Canvas renderer | WebGL2 (custom, no Three.js) |
| State management | Zustand + Immer |
| Build tool | Vite |
| Testing | Vitest (unit) · Playwright (E2E) |
| Rust crates | serde · rmp-serde · zstd · image · rayon · gif · color\_quant |

---

## Prerequisites

### Windows

1. **[Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)** — "Desktop development with C++" workload (~6 GB)
2. **[Rust](https://rustup.rs)** — run `rustup-init.exe`, accept defaults
3. **WebView2** — pre-installed on Windows 10 1803+ and Windows 11
4. **Node 20 LTS** — [nodejs.org](https://nodejs.org)
5. **pnpm** — `npm install -g pnpm` (skip Corepack on Windows — it hits keyid errors on some Node 20.16 builds)

### macOS

1. `xcode-select --install`
2. `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
3. Node 20 LTS from [nodejs.org](https://nodejs.org) or `brew install node`
4. `corepack enable pnpm`

### Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf build-essential curl wget file libssl-dev libayatana-appindicator3-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Then install Node 20 via nvm or nodesource, then:
corepack enable pnpm
```

Verify:

```bash
node --version    # v20.x or v22.x
pnpm --version    # 9.x
cargo --version   # 1.77+
```

---

## Getting started

```bash
pnpm install          # install frontend deps
pnpm tauri:dev        # launch the app (first run compiles Rust — takes a few minutes)
```

For frontend-only work without the native shell:

```bash
pnpm dev              # Vite at http://localhost:1420 — Tauri IPC calls won't work here
```

---

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Vite dev server only |
| `pnpm tauri:dev` | Full Tauri dev window with HMR |
| `pnpm build` | Type-check + production frontend build |
| `pnpm tauri:build` | Installer build (`.msi`/`.exe`, `.dmg`, `.deb`/`.AppImage`) |
| `pnpm typecheck` | TypeScript — no emit |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check (CI) |
| `pnpm test` | Vitest unit tests |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright E2E tests |

Rust-side checks (from `src-tauri/`):

```bash
cargo check
cargo clippy -- -D warnings
cargo fmt --check
cargo test
```

---

## Project structure

```
src/                        TypeScript (frontend)
  ui/                       React components
    canvas/                 CanvasViewport, WebGL host, interaction hooks
    toolbar/                Tool buttons, pixel-perfect / mirror toggles
    panels/
      LayerPanel/           Layer list, drag-reorder, group collapse
      Timeline/             Frame grid, transport, onion skin controls, frame tags
      ColorPickerPanel/     HSV / RGB / Hex pickers
      PalettePanel/         Swatch grid, import, palette-from-canvas
      ReferencePanel/       Reference image overlay controls
      NineSlicePanel/       Nine-slice preview
    menu/                   File, Edit, View menus (Tauri MenuBar)
    dialogs/                Export, Preferences, New Project, Crash Recovery
    primitives/             Dropdown, Tooltip, ContextMenu, Toast, SaveBadge
  state/
    useLayerStore.ts        Layer list + active layer
    useFrameStore.ts        Frames, cells, playback, onion skin, tags
    useProjectStore.ts      Canvas size, project path, dirty flag
    useHistoryStore.ts      Undo/redo command stack
    usePaletteStore.ts      Swatches + primary/secondary color
    useToolStore.ts         Active tool + per-tool options
    useUIStore.ts           UI toggles (grid, tile, nine-slice, …)
    action-composers/       Public action functions called by UI
    renderBridge.ts         Engine singleton + dirty-flag API
    toolBridge.ts           Tool event routing (pointerDown/Move/Up → tool)
  core/
    DataModel/              Layer, Frame, Cell, Palette types + factories
    CommandSystem/          Command interface + CommandManager
    commands/               LayerCommands, FrameCommands, PaletteCommands, …
    tools/                  BrushTool, EraserTool, LineTool, FillTool, …
    ToolEngine/             Tool registry + event dispatch
  render/
    RenderingEngine.ts      WebGL2 compositing, FBO ping-pong, group FBO, onion skin
    TextureCache.ts         LRU GPU texture cache
    shaders/                GLSL fragments (composite, blit, checkerboard, grid, tile)
  bridge/
    projectIpc.ts           Tauri IPC types (LayerDto, FrameDto, …)
    projectSerializer.ts    In-memory ↔ DTO conversion
    fileWatchListener.ts    Auto-save event handler
    exportIpc.ts            PNG / spritesheet / GIF export calls
    prefsIpc.ts             Preferences read/write
src-tauri/                  Rust backend
  src/
    lib.rs                  Tauri app setup
    project_io/             .rabit read/write (MessagePack + zstd)
    export/                 PNG, spritesheet, GIF export (rayon + gif crate)
    auto_save.rs            Periodic auto-save scheduler
    file_watcher.rs         FS watcher for crash-recovery
    prefs.rs                User preferences store
    fs_sandbox.rs           Path validation / sandbox enforcement
docs/                       PRD, architecture, design system, stack, data model, milestones
specs/                      Per-feature requirements → design → tasks (spec-driven workflow)
.rabit-memory/              AI project memory (decisions, risks, phase tracker)
tests/
  e2e/                      Playwright tests
  fixtures/                 Sample .rabit files, test PNGs
```

---

## Architecture principles

1. **One-way imports.** `UI → State → Core → Tauri IPC → Rust`. Never reversed.
2. **Every canvas mutation is a Command.** Undo/redo works because nothing writes pixels outside the command system.
3. **Delta-based undo.** Only changed pixels per operation are stored — not full snapshots. Required to keep memory sane at 4096 × 4096.
4. **GPU renders, Rust writes files.** No file I/O in TypeScript. No blocking the UI thread.
5. **Stroke preview on scratch buffer.** In-progress strokes are composited on a separate GPU texture; committed to the undo stack only on `pointerUp`.
6. **Atomic file writes.** `write → .rabit.tmp → checksum verify → OS rename`. Never overwrites the project file in place.

---

## Roadmap

| Milestone | Status | Description |
|---|---|---|
| M0–M6 | ✅ Done | Scaffold, canvas, WebGL renderer, layer system, tools, undo/redo, file I/O |
| M7–M9 | ✅ Done | Timeline, frame animation, onion skinning, palette, color picker |
| M10–M11 | ✅ Done | PNG/spritesheet/GIF export, preferences, keybindings |
| M12–M13 | ✅ Done | Selection tools, floating selection, move tool, canvas resize |
| M14 | ✅ Done | Pixel-perfect, reference image, nine-slice, layer FX, frame tags, palette-from-canvas, tile/mirror mode |
| M16 | ✅ Done | Layer groups + per-frame layer visibility |
| M15 | ⏳ Spec approved | Custom brush shapes, indexed color mode |
| M17 | ⏳ Spec approved | Spritesheet import, undo history panel |

---

## Documentation

- [`docs/PRD.md`](docs/PRD.md) — product requirements and feature priorities
- [`docs/architecture.md`](docs/architecture.md) — system layers, command system, rendering pipeline
- [`docs/design-system.md`](docs/design-system.md) — UI tokens, components, layout rules
- [`docs/stack.md`](docs/stack.md) — locked dependency versions and license audit
- [`docs/data-model.md`](docs/data-model.md) — in-memory types and `.rabit` binary format
- [`docs/milestones.md`](docs/milestones.md) — full build plan with exit criteria

---

## License

License TBD before first public release. All dependencies are MIT or Apache-2.0 per the stack policy ([`docs/stack.md`](docs/stack.md) §6).
