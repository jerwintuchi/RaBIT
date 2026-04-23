# Editor Core

Pure TypeScript business logic: tools, commands, selection, data model.

**Imports allowed:** `src/bridge`, external utility libraries (immer, nanoid).
**Imports forbidden:** `src/ui`, `src/state`, `src/render`, React.

No framework dependencies. All logic here must be unit-testable without a browser DOM.
