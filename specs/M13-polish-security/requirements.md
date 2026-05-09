# M13 — Polish, Performance Audit, Security Review — Stage 1: Requirements

## Problem Statement
All P0 features are implemented but have not been audited as a complete system against the NFRs, performance budgets, or security requirements. This milestone ensures RaBIT meets its v1.0 quality bar before release.

## User Stories
- As a user, I want the app to meet all performance budgets (60fps canvas, <16ms tool latency, <2s cold start) on the baseline machine so that the experience feels professional.
- As a user, I want the app to be free of known crashes across a 1-hour stress test so that I can trust it with real work.
- As a developer/maintainer, I want no High or Critical security findings in the Tauri IPC and file I/O paths so that the app is safe to ship.
- As a user, I want a working installer that produces a launchable app on a clean machine so that the app can be distributed.

## Acceptance Criteria
- WHEN the performance audit runs, THEN every NFR from `docs/PRD.md` §NFRs passes on the baseline machine.
- WHEN `/security-review` runs, THEN no High or Critical findings are reported.
- WHEN the app runs for 1 hour under continuous use (drawing, undo, layer ops, file save), THEN no crash or memory leak is observed.
- WHEN the installer is run on a clean Windows/macOS/Linux VM, THEN the app launches successfully.
- WHEN the binary is measured, THEN sizes are: <50MB Windows, <100MB macOS universal, <60MB Linux.
- WHEN all milestones (M9–M12) exit criteria are re-verified, THEN all pass.

## Out of Scope
- P1/P2 features (GIF export, selection tools, plugin system)
- Any new feature work — this milestone is audit and fix only

## Open Questions
- Baseline machine spec to be confirmed before audit begins.

## Source References
- `docs/PRD.md` §NFRs — full non-functional requirements list
- `docs/PRD.md` §constraints-risks — known risks to verify against
- `docs/milestones.md` §M13 — release checkpoint exit criteria
