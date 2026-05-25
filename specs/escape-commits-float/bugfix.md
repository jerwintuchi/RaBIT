# Bugfix: Escape commits floating selection before deselecting

## Bug description
**Observed:** After moving selected pixels (MarqueeTool or MoveTool float alive) and pressing Escape, Ctrl+Z does nothing — the move is not undoable.

**Expected:** Pressing Escape should commit the move (pushing a DrawCommand to the undo stack) and then clear the selection, consistent with how tool switches and deselect actions work.

## Reproduction steps
1. Use Magic Wand (or Marquee) to select some pixels.
2. Click inside the selection and drag to move the pixels to a new position; release.
3. Press Escape.
4. Press Ctrl+Z — nothing happens; the pixels remain at the new position and there is no undo entry.

## Root cause
`CanvasViewport.tsx:186` handles Escape by calling `useToolStore.getState().clearSelection()` directly, bypassing `commitFloatingSelection()`:

```ts
if (ev.key === 'Escape') { useToolStore.getState().clearSelection(); return; }
```

`commitFloatingSelection()` is required to call `onDeactivate()` on the active tool, which runs `commitFloating()` in MarqueeTool/MoveTool. Without it, `_floating` is orphaned — no DrawCommand is pushed, the GPU and the store diverge, and the undo history stays empty.

## Fix approach
**File:** `src/ui/canvas/CanvasViewport.tsx`, line 186

Import `commitFloatingSelection` from `../../state/toolBridge` and call it before `clearSelection()`:

```ts
if (ev.key === 'Escape') {
  commitFloatingSelection();
  useToolStore.getState().clearSelection();
  return;
}
```

No other files need to change. `commitFloatingSelection` is already exported from `toolBridge` and used in the same pattern by `selectionActions.ts`.

## Regression check
- After fix: Escape on a moved float → one DrawCommand in history → Ctrl+Z restores original positions.
- Escape with no float → `commitFloatingSelection` is a no-op (guards on `_floating === null`) → clearSelection works as before.
- Existing unit tests for MarqueeTool/MoveTool pass unchanged.
