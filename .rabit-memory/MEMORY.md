# RaBIT Project Memory Index

> Auto-managed memory for the RaBIT development project. Each entry links to a file with full context.

## Phase Tracker
- [Phase Status](phase-tracker.md) — current phase, completion status, blockers

## Product
- [PRD v1](product/prd.md) — full product requirements document
- [Target Users](product/users.md) — user personas and pain points

## Architecture & Technical Decisions
- [Stack Decision](decisions/stack.md) — Tauri + React + WebGL rationale
- [File Format](decisions/file-format.md) — .rabit binary format spec
- [Rendering Strategy](decisions/rendering.md) — WebGL2 canvas renderer design

## Design System
- [UI/UX Spec](design/ui-ux.md) — layout, panels, interaction model
- [Design Tokens](design/tokens.md) — colors, spacing, typography

## Implementation
- [Folder Structure](impl/folder-structure.md) — canonical source layout
- [Milestones](impl/milestones.md) — phase-by-phase build plan

## Agents & Skills
- [Agents & Skills Map](agents-and-skills.md) — when to invoke subagents/skills proactively per phase and task type

## Bug Fix History
- [Bug Fix History](bug-fix-history.md) — all bugs encountered and fixed; root causes, fixes, and rules to prevent recurrence. **Read before debugging any rendering, shader, or UI issue.**

## Known Risks & Constraints
- [Legal & Licensing](risks/legal.md) — library licenses, format patents, Aseprite differentiation
- [Performance Budgets](risks/performance.md) — canvas size limits, frame rate targets
- [Security Model (offline-only)](risks/security.md) — threat model, IPC/FS constraints, offline-only scope lock
