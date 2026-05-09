# M13 — Polish, Performance Audit, Security Review — Stage 2: Design

## Approach

M13 is audit-and-fix, not feature work. The milestone is structured in four sequential tracks:

1. **Code quality pass** — run `/simplify` skill on all changed modules; apply fixes
2. **Security review** — run `/security-review` skill on Rust IPC + file I/O paths; resolve findings
3. **Performance audit** — measure every PRD NFR programmatically where possible; manual where not
4. **Release packaging** — build artifacts for Windows, macOS, Linux; verify installers; write CHANGELOG

No new user-visible features are added unless they are bug fixes surfaced during audit.

## Affected Components

| Area | What changes |
|------|--------------|
| All Rust IPC commands | Path validation audit, input bounds checks, error message sanitisation |
| `src-tauri/src/project_io/` | Deserialization hardening (malformed data, oversized payloads) |
| `src-tauri/src/export/composite.rs` | Potential integer overflow on large canvas × high scale factor |
| `src-tauri/src/fs_sandbox.rs` | Verify path traversal prevention is complete |
| Any TS module flagged by `/simplify` | Dead code removal, duplicated logic, over-abstraction |
| `src-tauri/tauri.conf.json` | Capability tightening — restrict IPC surface to minimum required |
| `CHANGELOG.md` | New file — v1.0 release notes |

## Key Flows

### Track 1 — Code quality (`/simplify`)
- Invoke `/simplify` skill on each major module group in turn
- Apply non-breaking suggestions; skip anything that changes public API shape
- Re-run typecheck + cargo check after each batch

### Track 2 — Security review (`/security-review`)
- Invoke `/security-review` skill targeting Rust IPC surface
- Triage findings by severity: Critical/High must fix before release, Medium/Low document
- Key areas to check:
  - Path traversal in `fs_sandbox` (safe_write_path, safe_read_path)
  - Payload size limits on `save_project` / `export_png` / `export_spritesheet`
  - TOML injection in preferences (toml crate is safe but verify)
  - IPC capability scope in `tauri.conf.json` / capabilities JSON

### Track 3 — Performance audit
Measure each NFR from PRD §6.1:

| NFR | Measurement method |
|-----|--------------------|
| Canvas render ≥ 60fps | DevTools Performance panel, 512×512 canvas, all zoom levels |
| Tool latency < 16ms | `performance.now()` around pointerdown → GPU blit, 100-stroke average |
| Cold start < 2s | `pnpm tauri:dev` first-paint timing; release build timing |
| Undo/redo < 50ms | `performance.now()` wrapper in HistoryStore, 200 ops |
| Export < 5s | Existing progress timing from export IPC, 100 frames 256×256 |
| Memory ≤ 2GB | Windows Task Manager / macOS Activity Monitor, 200×4×512 fixture |

### Track 4 — Release packaging
- `pnpm tauri build` for each target
- Windows: MSI + NSIS bundles via Tauri bundler
- macOS: DMG universal (requires Mac build environment)
- Linux: AppImage + deb
- Verify installer on clean VM (or minimal Docker image for Linux)
- Binary size check against PRD limits

## Data Model Changes

None — M13 makes no schema or API changes. If a security fix requires an IPC signature change, it will be documented as an exception with a clear rationale.

## Trade-offs

| Decision | Chosen | Rejected | Reason |
|----------|--------|----------|--------|
| Fix order | Quality → Security → Perf → Package | Parallel tracks | Security fixes may touch same files as quality fixes; serial avoids merge conflicts in audit |
| Perf measurement | Manual + DevTools | Full automated benchmark harness | Building a full harness is M14+ work; manual measurement against clear pass/fail thresholds is sufficient for v1.0 |
| Cross-OS testing | Windows primary; macOS/Linux notes only | Full CI matrix | No macOS/Linux build environment available in this session; document what requires native env |

## Risks

- Performance findings may require non-trivial Rust changes (e.g. GPU pipeline restructure) — these would be scoped as a follow-up P0.5 patch rather than blocking v1.0 if the regression is < 10% of target.
- Installer signing requires code-signing certificates — if unavailable, ship unsigned with documentation.
- macOS universal binary requires Apple Silicon build environment — flag if unavailable.
