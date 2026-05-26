# Undo History Panel — Requirements

## Problem Statement
RaBIT has unlimited delta-based undo/redo but no way to see what those steps are. Artists working on complex edits want to jump back several steps confidently without blindly pressing Ctrl+Z multiple times. A visible history list makes undo navigation intentional rather than guesswork.

## User Stories
- As an artist, I want to see a list of my recent actions so I know what Ctrl+Z will undo.
- As an artist, I want to click a history entry to jump directly to that state so I don't have to step through every intermediate step.
- As an artist, I want the current position in history to be clearly highlighted so I always know where I am.

## Acceptance Criteria
- WHEN the Undo History panel is open, THEN it shows a scrollable list of undo stack entries in chronological order (oldest at top, most recent at bottom).
- WHEN the active undo position changes (via Ctrl+Z / Ctrl+Y), THEN the highlighted entry updates to match.
- WHEN the user clicks an entry above the current position, THEN undo is applied repeatedly until that entry is current (equivalent to pressing Ctrl+Z N times).
- WHEN the user clicks an entry below the current position, THEN redo is applied repeatedly until that entry is current.
- WHEN a new action is committed after undoing, THEN all entries after the current position are discarded (same as standard undo behavior).
- WHEN the stack exceeds the max undo limit (from preferences), THEN older entries are dropped from the top of the list.
- Each entry shows a short human-readable label (e.g. "Pencil stroke", "Add layer", "Delete frame", "Move", "Fill").
- The panel is accessible from the Window menu and is off by default (not shown in the default layout).
- The panel does NOT slow down undo/redo operations — it reads the existing undo stack, it does not change how it works.

## Out of Scope
- Branching history (non-linear undo trees).
- Per-entry thumbnails (too expensive to generate for every stroke).
- Filtering or searching history.

## Open Questions
- Where does this panel live in the default layout? (Proposed: collapsible section below the Layer panel, hidden by default.)
