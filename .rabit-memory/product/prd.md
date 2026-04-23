---
name: RaBIT PRD Summary
description: Key decisions and constraints from the Product Requirements Document
type: project
---

PRD v1.0 written and stored at docs/PRD.md.

**Why:** Establish product scope before any architecture or code decisions.
**How to apply:** Before implementing any feature, verify it is P0 (MVP) or P1 (v1.0) in the PRD. Do not build P2 features ahead of P0.

Key scope decisions:
- Canvas: 1×1 to 4096×4096 px
- No anti-aliasing (pixel art fundamental)
- Undo: delta-based (not snapshot), 200 steps default
- Export: background thread, non-blocking
- GIF export is P1 (v1.0), not MVP
- Plugin system is P2 (v1.5)
- Aseprite importer is P1 (v1.0, reduces migration friction)
- File format: binary .rabit, zlib-compressed, schema-versioned
- Distribution: direct download initially, Steam at v1.0
- Pricing: free beta, one-time paid license at v1.0 (no subscription)
