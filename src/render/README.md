# Rendering Engine

WebGL2 canvas management: framebuffers, shaders, texture cache, compositor.

**Imports allowed:** `src/core` (data types only), external WebGL/math helpers.
**Imports forbidden:** `src/ui`, `src/state`, React.

Pure rendering — no React, no Zustand. Exposes an imperative API consumed by the state layer.
