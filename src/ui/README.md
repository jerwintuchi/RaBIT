# UI Layer

React components (panels, toolbar, canvas viewport host, dialogs).

**Imports allowed:** `src/state`, `src/bridge`, `src/styles`, `src/assets`, and external packages including React.
**Imports forbidden:** `src/core`, `src/render` (reach these through the state layer — architecture §4).

Components are "dumb": they read from Zustand stores and dispatch actions. No business logic in components.
