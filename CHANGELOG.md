# Changelog

All notable changes to RaBIT are documented here.

## [1.0.0] — 2026-05-10

### Added

**Canvas & Rendering**
- WebGL2 rendering engine with GPU-composited layer stack
- Checkerboard transparency background shader
- Zoom (1× – 64×) and pan with smooth viewport interaction
- Canvas resize (up to 4096×4096) — all GPU textures evicted and re-uploaded at new size to prevent GL errors

**Drawing Tools**
- Pencil — pixel-perfect freehand with pressure-mapped opacity
- Eraser — alpha-blended erase with configurable size
- Line — preview line rendered on scratch buffer, committed on release
- Rectangle and Ellipse — outline and fill variants
- Flood Fill — 4-connected tolerance fill
- Move — layer translate with real-time GPU preview
- Marquee — rectangular selection with cut/copy/paste
- Eyedropper — samples composited pixel at cursor
- Hand — pan viewport via drag
- Zoom — click to zoom in/out toward cursor point

**Layer System**
- Unlimited layers per frame (practical limit: 256)
- Layer visibility toggle, opacity slider, blend mode selector (Normal / Multiply / Screen / Overlay / Add / Subtract)
- Layer lock — prevents accidental edits, shows locked cursor
- Layer thumbnails — real-time GPU readback with 8× downsampled preview

**Frame Animation & Timeline**
- Unlimited frames (practical limit: 10 000)
- Add, duplicate, delete, reorder frames
- Per-frame duration (ms)
- Onion skinning — configurable opacity, preceding/following frame count

**Color**
- HSV color picker with Hex and RGB input modes
- 16-color history ring
- Swatch palette — add, rename, drag-reorder, context-menu delete
- Import `.ase`/`.aseprite` palettes (best-effort; format undocumented by Adobe)
- Primary/secondary color swap (X) and reset to black/white (D)

**Undo / Redo**
- Delta-based undo: stores only changed pixels per stroke, not full canvas snapshots
- 1 000-operation history (configurable in Preferences)
- Unlimited redo after undo

**File I/O**
- `.rabit` project format (MessagePack + zstd compression)
- Atomic write: draft → `.rabit.tmp` → checksum verify → OS rename — no data loss on crash
- Auto-save at configurable interval (default 5 minutes)
- File-watcher: detects external modification and prompts to reload
- Recent files list (last 10)

**Export**
- PNG export — single frame, full resolution
- Spritesheet export — all frames packed into a grid PNG, configurable columns and scale
- Non-blocking: export runs on Rust thread pool; progress events streamed to UI

**Preferences**
- UI scale: 0.9×, 1.0×, 1.25× (applies via CSS zoom; no restart required)
- Autosave interval and undo history depth
- Default frame duration
- Fully remappable keybindings with conflict detection
- Settings persisted to TOML (`%APPDATA%\RaBIT\prefs.toml` on Windows)
- Corrupt prefs fall back to defaults automatically

**Keyboard Shortcuts** (default)
- Tools: B Pencil, E Eraser, L Line, I Eyedropper, H Hand, Z Zoom
- Color: X swap, D reset
- File: Ctrl+N New, Ctrl+O Open, Ctrl+S Save, Ctrl+Shift+S Save As, Ctrl+E Export
- Edit: Ctrl+Z Undo, Ctrl+Y Redo, Ctrl+, Preferences
- Frame: Ctrl+Alt+N Add Frame, Ctrl+Alt+D Duplicate Frame

**Security & Validation**
- Path sandbox: all file reads/writes validated — absolute paths only, no `..` traversal
- Canvas dimension limit enforced on load: max 4096×4096
- Tauri capability manifest restricts IPC surface to declared commands only
- No external network access

### Performance

| Metric | Target | Result |
|--------|--------|--------|
| Canvas render | ≥ 60 fps | INP 30 ms — no frame drops observed |
| Tool latency p99 | < 16 ms | 12.4 ms |
| Undo p99 | < 50 ms | 13.1 ms |
| Redo p99 | < 50 ms | 13.0 ms |
| Memory (10 min draw session) | ≤ 2 GB | ~10 MB |
| Export (spritesheet) | < 5 s | < 1 s |

### Platform Support

- Windows 10 / 11 (x86-64) — MSI and NSIS installers
- Linux — AppImage and .deb (x86-64)
- macOS — DMG (arm64 / x86-64 universal)
