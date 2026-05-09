# M13 — Polish, Performance Audit, Security Review — Stage 3: Tasks

## Task List

### Track 1 — Code Quality

- [ ] **T1 — Run `/simplify` on Rust backend modules**
  - Scope: `src-tauri/src/` — all modules (prefs, project_io, export, auto_save, fs_sandbox, file_watcher)
  - Apply non-breaking suggestions; skip anything that changes public API shape
  - Check: `cargo check` passes after each batch

- [ ] **T2 — Run `/simplify` on TypeScript state + bridge**
  - Scope: `src/state/`, `src/bridge/`
  - Apply suggestions; re-run `pnpm typecheck`

- [ ] **T3 — Run `/simplify` on TypeScript UI**
  - Scope: `src/ui/` — dialogs, panels, canvas, toolbar, menu
  - Apply suggestions; re-run `pnpm typecheck`

### Track 2 — Security

- [ ] **T4 — Run `/security-review` on Rust IPC + file I/O**
  - Skill invocation targets: `src-tauri/src/fs_sandbox.rs`, `src-tauri/src/project_io/`, `src-tauri/src/export/`, `src-tauri/src/prefs.rs`, `src-tauri/src/auto_save.rs`
  - Triage all findings by severity
  - Fix all Critical and High findings before proceeding

- [ ] **T5 — Harden IPC input validation**
  - Add payload size limits to `save_project` and `export_*` commands (reject if serialised payload > 512MB)
  - Verify `fs_sandbox::safe_write_path` covers all write paths (cross-check with every `std::fs::write` call)
  - Verify `tauri.conf.json` / capabilities JSON grants minimum required permissions
  - Check: `cargo check` passes; manual test of oversized input

- [ ] **T6 — Harden project deserializer**
  - Files: `src-tauri/src/project_io/deserialize.rs`
  - Add canvas dimension sanity check: reject if width × height > 4096 × 4096
  - Add layer / frame count limits matching PRD memory budget
  - Check: `cargo check` passes; unit tests for rejection cases

### Track 3 — Performance Audit

- [ ] **T7 — Canvas render benchmark**
  - Open 512×512 canvas with 4 layers, draw continuously for 10s
  - Measure FPS with DevTools Performance panel at 1×, 4×, 8× zoom
  - Pass criterion: sustained ≥ 60fps at all zoom levels
  - Document result; file issue if failing

- [ ] **T8 — Tool latency benchmark**
  - Add `performance.now()` probe: `pointerdown` → end of `requestAnimationFrame` after GPU blit
  - Run 100 pencil strokes on 512×512 canvas; log p50 and p99
  - Pass criterion: p99 < 16ms
  - Remove probe after measurement; document result

- [ ] **T9 — Cold start benchmark**
  - Release build (`pnpm tauri build`); measure time from process start to first frame visible
  - Pass criterion: < 2 seconds
  - Document result

- [ ] **T10 — Undo/redo benchmark**
  - Apply 200 pencil strokes; time 200 undos and 200 redos using `performance.now()`
  - Pass criterion: each op < 50ms
  - Document result

- [ ] **T11 — Export benchmark**
  - Export 100 frames at 256×256 as spritesheet
  - Measure wall-clock time from Export click to completion toast
  - Pass criterion: < 5 seconds
  - Document result

- [ ] **T12 — Memory ceiling check**
  - Load 200-frame × 4-layer × 512×512 canvas (use `seedPerfFixture` or equivalent)
  - Measure memory in Task Manager / Activity Monitor after 10-minute drawing session
  - Pass criterion: ≤ 2GB
  - Document result

### Track 4 — Release Packaging

- [ ] **T13 — Windows installer build**
  - Run `pnpm tauri build` on Windows
  - Verify MSI and NSIS bundles are produced in `src-tauri/target/release/bundle/`
  - Check binary size: < 50MB
  - Install on a clean Windows VM; verify app launches and opens a project

- [ ] **T14 — Linux AppImage + deb build**
  - Run `pnpm tauri build` on Linux (Ubuntu)
  - Verify AppImage and .deb are produced
  - Check binary size: < 60MB
  - Install AppImage on clean Ubuntu; verify app launches

- [ ] **T15 — macOS DMG build** *(requires Mac environment — skip if unavailable, document)*
  - Run `pnpm tauri build --target universal-apple-darwin` on macOS
  - Verify DMG is produced
  - Check binary size: < 100MB
  - Install on clean macOS VM (Intel and ARM); verify app launches

- [ ] **T16 — Write `CHANGELOG.md`**
  - File: `CHANGELOG.md` (project root)
  - Document all M0–M12 deliverables in user-facing language
  - Format: Keep-a-Changelog convention (Added / Changed / Fixed sections)
  - Include v1.0.0 release date placeholder

- [ ] **T17 — Final verification + tag**
  - Re-run full test suite: `pnpm test`, `cargo test`
  - Run `pnpm typecheck` and `cargo check` — zero errors
  - All performance benchmarks documented and passing
  - No High/Critical security findings open
  - Commit all fixes, tag `v1.0.0`
  - Update `.rabit-memory/phase-tracker.md` (Phase 7 complete)

## Dependencies

```
T1 → T2 → T3          (quality, serial to avoid conflicts)
T1 → T4 → T5 → T6     (security depends on simplify first)
T3 → T7 → T8 → ... → T12   (perf after code is stable)
T12 → T13 → T14 → T15 → T16 → T17
```

## Notes

- T13–T15 require native build environments; Windows is primary. macOS and Linux steps may be deferred if hardware is unavailable.
- Performance findings that require > 1 day of work should be filed as issues and documented rather than blocking the v1.0 tag, provided the regression is < 10% of target.
- `/simplify` and `/security-review` are skill invocations — they run as separate agent passes. Wait for each to complete before proceeding.
