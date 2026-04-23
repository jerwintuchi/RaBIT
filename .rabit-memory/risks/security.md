---
name: Security Model (offline-only)
description: Threat model and security scope for RaBIT v1 — locked as offline-only desktop app
type: project
---

# Security Model (v1.0 — 2026-04-19)

RaBIT v1 is **offline-only**. This is a load-bearing architectural property, not just a feature cut. Full context in `docs/stack.md` §2 and `docs/architecture.md` §10–12.

## What "offline-only" means (v1 scope lock)

The shipping binary must not contain:
- Any HTTP client (no `reqwest`, `ureq`, `fetch`-from-JS to non-localhost)
- Any telemetry / analytics SDK
- Any auto-updater
- Any crash-reporting service (crashes → local log file only)
- Any online palette/asset library integration (Lospec, etc.)
- Any cloud save / sync

**Why:** sharply reduces attack surface, removes privacy concerns, avoids network-failure UX complexity for an MVP.

**How to apply:** If a future task proposes adding any of the above, treat it as a scope decision that requires explicit PRD update — not a casual dependency add. Plugin system (P2) is the biggest exception-to-come and will need its own security design pass.

## Real threat model (what DOES apply)

Even offline, desktop apps that parse user files have a threat model. The surface for RaBIT:

1. **Malicious `.rabit` files** — a shared sprite file triggering parser bugs (zstd decompression bomb, oversized alloc, OOB read in deserializer).
   - *Mitigation:* Rust memory safety + `proptest` fuzzing on the file format deserializer + hard limits on decompressed size (e.g., reject `.rabit` files that would decompress to >2GB).
2. **Path traversal on import/export** — a `.rabit` or palette file embedding paths like `../../AppData/...`, tricking export to write outside the user's chosen directory.
   - *Mitigation:* `fs_sandbox` Rust module (architecture §11) canonicalizes and allowlist-checks every path before any write.
3. **Tauri IPC pivot** — if a malicious file's metadata ever gets rendered as HTML in the UI (XSS in renderer), attacker gains access to every `#[tauri::command]`.
   - *Mitigation:* architecture §10 rule — "No Tauri command accepts raw file content from the renderer." Metadata is always escaped; never rendered as HTML.
4. **Malicious PNG / palette imports** — third-party parsers (image crate) have had CVEs historically.
   - *Mitigation:* Keep `image` crate on latest patch; `cargo audit` in CI.

## What does NOT apply (can safely ignore)

- Authentication / session management — no accounts
- CSRF — no network
- SQL injection — no database
- XSS from network content — no network
- Transport security (TLS, cert pinning) — no network
- CORS — no network
- OAuth / API tokens — no network

## Security review cadence

- `/security-review` (built-in skill) runs before each release
- First mandatory run: when the Rust `.rabit` deserializer is written in Phase 7
- `cargo audit` and `pnpm audit` run in CI on every PR

## Load-bearing constraints

- **Do not accept raw file content over Tauri IPC.** Renderer passes structured payloads (pixel buffers, metadata); Rust owns all filesystem paths.
- **All file writes go through `fs_sandbox`.** No `std::fs::write` calls outside that module.
- **Hard limits on deserializer input.** Document and enforce max canvas dims (4096×4096), max frames, max decompressed size.

**How to apply:** Any task touching file I/O, deserialization, or Tauri commands must pass these constraints. If a task proposes bypassing them "temporarily," refuse and ask for explicit approval first.
