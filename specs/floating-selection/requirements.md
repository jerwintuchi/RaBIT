# Floating Selection — Requirements

## Problem Statement

Currently, when selected pixels are moved onto existing (unselected) pixels, the underlying pixels are permanently overwritten at drop time. Each `pointerUp` commits a `DrawCommand` that erases source positions and writes to destination positions. On a second drag the ambient pixel that was overwritten is gone, so it appears to "stick" to the moving selection.

The user expects **non-destructive move** behaviour: the original pixels at the destination survive underneath the floating selection and are only permanently replaced when the floating selection is explicitly committed (tool switch, deselect, Escape-confirm).

---

## User Stories

- As a **pixel artist**, I want to reposition selected pixels multiple times before committing, so that I can freely experiment with placement without permanently destroying what was at the destination.
- As a **pixel artist**, I want pixels that are underneath my floating selection to reappear when I move the selection off them, so I have a clear view of the canvas before committing.
- As a **pixel artist**, I want to cancel a floating move entirely (Escape) and have all pixels return to their original positions.
- As a **pixel artist**, I want the entire float sequence to produce a single undo step so that Ctrl+Z cleanly reverts the whole move without partial states.

---

## Acceptance Criteria

| # | WHEN | THEN |
|---|------|------|
| AC-1 | Selected pixels are dropped onto existing pixels | The existing pixels are visually covered but NOT yet written to the layer buffer |
| AC-2 | The user picks up the same floating selection and moves it again | The pixels that were underneath at the previous position reappear on the canvas |
| AC-3 | The user switches tool while a floating selection is active | The floating selection is automatically committed (one `DrawCommand` added to history) |
| AC-4 | The user starts a new marquee drag or magic-wand click while floating | The floating selection is committed before the new selection begins |
| AC-5 | The user presses Escape while floating (no active drag in progress) | The floating pixels return to their original positions and the layer is restored; no `DrawCommand` is added |
| AC-6 | The user presses Escape during an active drag | The in-progress drag is cancelled; floating state reverts to the last committed float position |
| AC-7 | The floating selection is committed (any trigger) | A single `DrawCommand` is executed covering the full delta from the original source positions to the final destination positions |
| AC-8 | Ctrl+Z is pressed after the floating selection is committed | The entire move (original → final) is undone in one step |
| AC-9 | The floating selection is active and the active layer is locked | Committing is blocked; the user can still Escape to cancel |

---

## Scope

**In scope:**
- `MoveTool` (when a selection is active — single-layer move)
- `MarqueeTool` internal move mode (drag inside a committed selection)
- Auto-commit on tool switch, new selection start, and Escape (cancel)
- Single `DrawCommand` per full float sequence

**Out of scope:**
- Multi-layer floating compositing
- Floating selection with opacity/blend modes
- Floating selection persisting across undo of the original lift (undo collapses the whole float anyway)
- Magic Wand tool's own move mode (magic wand currently relies on MoveTool for the actual move)

---

## Open Questions

1. Should clicking *inside* the current selection while floating restart the drag (continue floating), or commit + start a new float? → **Proposal:** continue floating (same behaviour as today — click inside enters move mode).
2. Should clicking *outside* the current selection while floating commit silently, or prompt the user? → **Proposal:** commit silently (matches Aseprite behaviour).
3. What visual indicator (if any) should communicate that a floating selection is active vs. a regular committed selection? → **Proposal:** no extra indicator for MVP; can be added as a polish item.
