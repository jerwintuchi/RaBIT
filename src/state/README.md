# State Layer

Zustand stores + action composers.

**Imports allowed:** `src/core`, `src/render`, `src/bridge`, external state libraries (zustand, immer).
**Imports forbidden:** `src/ui`, React components/hooks.

Stores do not import each other — cross-store logic lives in `action-composers/` (plain functions that call multiple store actions).
