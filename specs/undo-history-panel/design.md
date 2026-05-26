# Undo History Panel — Design

## Approach
`useHistoryStore` already holds a `CommandManager` whose `getUndoStack()` and `getRedoStack()` return `readonly Command[]`. Each `Command` already has `id` and `description` fields. We expose the stacks reactively by adding them to the store's state and updating them in the existing `sync()` callback. A new panel component reads the store and renders a scrollable list. Clicking an entry triggers multiple `undo()` or `redo()` calls until the stack reaches that position.

## Affected Components

| File | Change |
|---|---|
| `src/state/useHistoryStore.ts` | Add `undoStack: readonly Command[]` and `redoStack: readonly Command[]` to state; update `sync()` to copy stack arrays |
| `src/ui/panels/UndoHistoryPanel/UndoHistoryPanel.tsx` | New panel component |
| `src/ui/panels/UndoHistoryPanel/UndoHistoryPanel.module.css` | New styles |
| `src/ui/panels/index.ts` | Export `UndoHistoryPanel` |
| `src/ui/menu/` (Window menu or View menu) | Add "Undo History" toggle menu item |
| `src/state/useUIStore.ts` | Add `showUndoHistory: boolean`, `setShowUndoHistory(v)` |
| `src/App.tsx` | Conditionally render `<UndoHistoryPanel />` when `showUndoHistory` is true |

## Data Model Changes
No changes to `Project` or command types. `useHistoryStore` gains two new reactive fields:
```ts
undoStack: readonly Command[];  // mirrors manager.getUndoStack()
redoStack: readonly Command[];  // mirrors manager.getRedoStack()
```

## Key Flows

### Stack sync
```ts
// In useHistoryStore
const sync = () =>
  set(() => ({
    undoCount: get().manager.getUndoStack().length,
    redoCount: get().manager.getRedoStack().length,
    undoStack: get().manager.getUndoStack(),  // added
    redoStack: get().manager.getRedoStack(),  // added
  }));
```
`getUndoStack()` returns a reference to the internal array (not a copy). We store that reference; React will see a new reference after each `sync()` call because `CommandManager` replaces its array on every `push`/`pop`. If it mutates in place, a shallow copy (`[...manager.getUndoStack()]`) is needed — this will be confirmed during implementation.

### Panel display
- The list renders `undoStack` (bottom = most recent) + `redoStack` (top = first redo available).
- The boundary between the two stacks is the "current" position, highlighted with a horizontal rule.
- Undo entries are shown oldest-to-newest top-to-bottom; redo entries follow below the divider.
- The current-position entry (bottom of undo stack) has a distinct highlight style.
- Auto-scroll to keep the current position visible whenever the stacks change.

### Jump to history entry
```ts
const handleClick = (stackType: 'undo' | 'redo', index: number) => {
  if (stackType === 'undo') {
    // index from the top of the undo stack (0 = most recent)
    const stepsBack = undoStack.length - 1 - index;
    for (let i = 0; i < stepsBack; i++) undo();
  } else {
    // index from the bottom of the redo stack (0 = next redo)
    const stepsForward = index + 1;
    for (let i = 0; i < stepsForward; i++) redo();
  }
};
```
This is synchronous — all undo/redo calls complete before React re-renders. Acceptable for stacks up to 1000 entries since each `undo()` operation is already guaranteed < 50ms.

### Panel layout
- Renders as a collapsible section below the Layer Panel in the right sidebar, hidden by default.
- Header: "History" label + entry count.
- List items: `<li>` with the command's `description` text.
- Redo items are visually muted (greyed out) to indicate they are "future" states.

## Trade-offs
- **Multiple sequential undo calls vs. jump command**: calling `undo()` N times is simpler than a new `jumpToHistoryIndex` API on the CommandManager. The sequential calls fire `onChange` after each, causing N React renders — acceptable since this is a user-triggered action, not an animation-frame path.
- **No per-entry thumbnails**: generating a WebGL snapshot per command would be too expensive and complex. Descriptions alone are sufficient for navigation.
- **Panel off by default**: keeps the default layout clean. Power users who want it can enable it from the View/Window menu.

## Risks
- If `CommandManager` mutates its internal array (splice in place), `sync()` will capture stale references. Confirm during implementation and add a shallow copy if needed.
