# Undo History Panel — Tasks

## Task 1 — Expose stacks reactively in `useHistoryStore`
**Files:** `src/state/useHistoryStore.ts`
- Add `undoStack: readonly Command[]` and `redoStack: readonly Command[]` to the store interface and initial state (both `[]`)
- In `sync()`, also set `undoStack` and `redoStack`:
  - If `CommandManager.getUndoStack()` returns a reference that is mutated in-place, use a shallow copy: `[...manager.getUndoStack()]`
  - Same for redoStack
**Acceptance:** `pnpm typecheck` passes; `undoStack.length` equals `undoCount` after each operation.

## Task 2 — `UndoHistoryPanel` component
**Files:** `src/ui/panels/UndoHistoryPanel/UndoHistoryPanel.tsx` (new)
- Subscribe to `useHistoryStore` for `undoStack`, `redoStack`, `undo`, `redo`
- Render a scrollable `<ul>`:
  - Undo entries (oldest → newest top to bottom): each is a `<li>` with `description` text; the bottommost undo entry (most recent) has `.currentEntry` style
  - A `<li className={styles.currentDivider}>▶ current</li>` rule between undo and redo sections
  - Redo entries below the divider, visually muted
- Click handler on each entry: compute how many undo/redo steps needed, call `undo()` or `redo()` that many times
- `useEffect` to auto-scroll the current-entry `<li>` into view whenever stacks change
**Depends on:** Task 1
**Acceptance:** Panel renders the history list; clicking entries navigates; `pnpm typecheck` passes.

## Task 3 — `UndoHistoryPanel` styles
**Files:** `src/ui/panels/UndoHistoryPanel/UndoHistoryPanel.module.css` (new)
- `.panel`: `display: flex; flex-direction: column; height: 100%; background: var(--bg-1);`
- `.header`: `height: 32px; display: flex; align-items: center; padding: 0 var(--space-2); border-bottom: 1px solid var(--border-subtle);`
- `.list`: `flex: 1; overflow-y: auto; padding: var(--space-1);`
- `.entry`: `padding: 2px var(--space-2); font-size: var(--text-xs); cursor: pointer; border-radius: var(--radius-sm);`
- `.entry:hover`: `background: var(--bg-3);`
- `.currentEntry`: `background: var(--accent-primary-dim, rgba(99,153,255,0.15)); font-weight: 600;`
- `.redoEntry`: `color: var(--text-disabled, #555);`
- `.currentDivider`: `font-size: 10px; color: var(--text-secondary); padding: var(--space-1) var(--space-2); list-style: none;`
**Acceptance:** Styles match the dark professional aesthetic of the rest of the app.

## Task 4 — Export panel
**Files:** `src/ui/panels/index.ts`
- Add `export { UndoHistoryPanel } from './UndoHistoryPanel/UndoHistoryPanel';`
**Depends on:** Task 2
**Acceptance:** `pnpm typecheck` passes.

## Task 5 — `showUndoHistory` in UI store
**Files:** `src/state/useUIStore.ts`
- Add `showUndoHistory: boolean` (default `false`)
- Add `setShowUndoHistory(v: boolean): void` setter
**Acceptance:** `pnpm typecheck` passes.

## Task 6 — Toggle in View/Window menu
**Files:** `src/ui/menu/ViewMenu.tsx` (or whichever menu is most appropriate)
- Add "Undo History" checked menu item
- Reads `useUIStore.showUndoHistory`; clicking calls `setShowUndoHistory(!current)`
**Depends on:** Task 5
**Acceptance:** Menu item toggles; `pnpm typecheck` passes.

## Task 7 — Conditional render in `App.tsx`
**Files:** `src/App.tsx`
- Import `UndoHistoryPanel`
- Subscribe to `useUIStore.showUndoHistory`
- When `true`, render `<UndoHistoryPanel />` in the right-sidebar area (below the Layer Panel)
**Depends on:** Tasks 4, 5, 6
**Acceptance:** Panel appears/disappears when toggled from menu; `pnpm typecheck` passes.

## Task 8 — Verification
- Run `pnpm build` — 0 errors
- Run `pnpm test` — all pass
- Manual: perform 5 paint strokes; open history panel; click the 3rd entry; verify canvas reverts and 2 entries show as redo; click the last redo entry; verify forward navigation works
