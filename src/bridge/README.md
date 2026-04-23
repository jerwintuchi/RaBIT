# Tauri IPC Bridge

Typed wrappers for `@tauri-apps/api` calls and event subscriptions.

**Imports allowed:** `@tauri-apps/api` and nothing else from the codebase.
**Imports forbidden:** `src/ui`, `src/state`, `src/core`, `src/render`.

Bridge is pure plumbing. It knows the shape of IPC payloads (defined as types here) but nothing about how callers use them.
