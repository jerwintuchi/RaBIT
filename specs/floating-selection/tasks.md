# Floating Selection — Tasks

All tasks must be completed in order. Run `pnpm typecheck` after every task that touches TypeScript. Run `pnpm build` on the final task.

---

## Task 1 — Add `onDeactivate` to the `Tool` interface
**File:** `src/core/ToolEngine/types.ts`

Add an optional `onDeactivate?(): void` method to the `Tool` interface after `onKeyDown`.

**Acceptance:** `pnpm typecheck` passes; no existing tool is broken (method is optional).

---

## Task 2 — Update `ToolEngine` to call `onDeactivate` on tool switch; add `commitPendingOps`
**File:** `src/core/ToolEngine/ToolEngine.ts`

1. In `setActiveTool`, replace the existing `this.active.onCancel()` call with:
   - `this.active.onDeactivate()` if the tool has it, otherwise `this.active.onCancel()`.
2. Add a public `commitPendingOps(): void` method that calls `this.active?.onDeactivate?.()` without switching tools.

**Acceptance:** `pnpm typecheck` passes; tool switch still triggers cleanup on the outgoing tool.

---

## Task 3 — Expose `commitFloatingSelection` from `toolBridge`
**File:** `src/state/toolBridge.ts`

Export a new function:
```ts
export function commitFloatingSelection(): void {
  _toolEngine?.commitPendingOps();
}
```

No change needed to `setActiveTool` — `ToolEngine.setActiveTool` now calls `onDeactivate` internally.

**Acceptance:** `pnpm typecheck` passes; `commitFloatingSelection` is importable from `toolBridge`.

---

## Task 4 — Implement floating-state machine in `MoveTool`
**File:** `src/core/tools/MoveTool.ts`

### 4a — Add `FloatingState` type and fields
Add a file-private interface and three new fields:
```ts
interface FloatingState {
  pixels: Array<{ x: number; y: number; color: RGBA }>;
  background: Uint8ClampedArray;      // mutable; source=0, current dest = floating pixels
  originalLayerBuf: Uint8ClampedArray; // frozen; never modified after creation
  originalSelection: SelectionMask | null;
  layerId: LayerId;
  currentDx: number;
  currentDy: number;
}

// inside MoveTool class:
private _floating: FloatingState | null = null;
private _backgroundSnapshot: Uint8ClampedArray | null = null; // snapshot at drag start
```

Remove the `selBoundsAtStart` field — it is replaced by `_floating.originalSelection` and the drag-offset pattern.

### 4b — Rewrite `onPointerDown`

**When `_floating` is active (same `layerId`):**
- Snapshot `background`: `_backgroundSnapshot = _floating.background.slice()`.
- Set `_prevMoveDx = _floating.currentDx`, `_prevMoveDy = _floating.currentDy`.
- Set `this.layerId`, `this.layerBuf`, `this.pixels = _floating.pixels`.
- Upload `_floating.background` to GPU via `previewLayerOnGPU` (already correct state).
- Init scratch with floating pixels at `_floating.currentDx / currentDy`.
- Set `active = true`.

**When `_floating` is null (new float):**
- Capture pixels from the selection mask (same logic as today, but with `hasMask` guard).
- If no pixels captured, bail (no float created).
- Create `_floating`:
  - `originalLayerBuf = new Uint8ClampedArray(layerBuf)` (frozen copy).
  - `background = new Uint8ClampedArray(layerBuf)`; zero every captured pixel position.
  - `originalSelection = ctx.getSelection()`.
  - `layerId`, `pixels`, `currentDx = 0`, `currentDy = 0`.
- `_backgroundSnapshot = _floating.background.slice()`.
- `_prevMoveDx = 0`, `_prevMoveDy = 0`.
- Upload `_floating.background` to GPU.
- Init scratch at offset 0.
- Set `active = true`.

*Drop the `this.selBoundsAtStart` assignment; selection-drag-offset is still set in `onPointerMove` using `_floating.originalSelection?.bounds` offset.*

### 4c — Update `_updateMovePreview`
Change `orig` to always read from `_floating.originalLayerBuf` (instead of `this.layerBuf`) so that restoring previous destination footprints always yields the ORIGINAL ambient pixel values regardless of how many times the selection has been repositioned.

```ts
const orig = this._floating?.originalLayerBuf ?? this.layerBuf!;
```

### 4d — Rewrite `onPointerUp`

1. Compute `(dx, dy)` = pointer position − drag start.
2. Call `_updateMovePreview(dx, dy)` one final time.
3. Write floating pixels at their final positions into `_floating.background`:
   ```ts
   for (const { x, y, color } of this._floating.pixels) {
     const nx = x + this._floating.currentDx + dx_segment;
     const ny = y + this._floating.currentDy + dy_segment;
     if valid: writePixel(_floating.background, nx, ny, w, color);
   }
   ```
4. Update `_floating.currentDx += dx_segment`, `_floating.currentDy += dy_segment`.
   *(Track the cumulative displacement from the original source positions.)*
5. Upload `_floating.background` to GPU via `previewLayerOnGPU`.
6. Clear scratch.
7. Call `ctx.setSelectionDragOffset(null)`.
8. Rebuild selection at the new exact pixel positions (same logic as the current code but using `_floating.pixels` and the new cumulative offset).
9. **Do NOT execute a `DrawCommand`.**
10. `active = false`.

### 4e — Add `commitFloating()` (private helper)

```ts
private commitFloating(): void {
  if (!this._floating) return;
  const { pixels, originalLayerBuf, layerId, currentDx, currentDy } = this._floating;
  const liveBuf = this.ctx.getLayerData(layerId);
  if (!liveBuf) { this._floating = null; return; }
  const w = this.scratchW;
  const deltaMap = new Map<number, PixelDelta>();

  // Erase source positions
  for (const { x, y } of pixels) {
    const key = y * w + x;
    if (!deltaMap.has(key))
      deltaMap.set(key, { x, y, before: readPixel(originalLayerBuf, x, y, w), after: 0 });
  }
  // Write final destination positions
  for (const { x, y, color } of pixels) {
    const nx = x + currentDx; const ny = y + currentDy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= this.scratchH) continue;
    const key = ny * w + nx;
    const existing = deltaMap.get(key);
    if (existing) existing.after = color;
    else deltaMap.set(key, { x: nx, y: ny, before: readPixel(originalLayerBuf, nx, ny, w), after: color });
  }

  this._floating = null;
  this._backgroundSnapshot = null;
  this.active = false;
  this.layerId = null;
  this.layerBuf = null;
  this.pixels = [];
  this.ctx.setSelectionDragOffset(null);
  this.ctx.clearScratch();

  if (deltaMap.size === 0) {
    this.ctx.previewLayerOnGPU(layerId, liveBuf);
    return;
  }
  const cmd = new DrawCommand(
    layerId, Array.from(deltaMap.values()), liveBuf, w,
    (id, data) => this.ctx.notifyLayerChanged(id, data),
    'Move selection',
  );
  this.ctx.executeCommand(cmd);
}
```

### 4f — Add `onDeactivate`

```ts
onDeactivate(): void {
  this.commitFloating();
  // If a non-floating drag was somehow active, clean it up
  if (this.active) this.onCancel();
}
```

### 4g — Update `onCancel`

```ts
onCancel(): void {
  if (this.active && this._floating) {
    // Cancel the current drag segment; restore background to pre-drag snapshot
    this.active = false;
    if (this._backgroundSnapshot) {
      this._floating.background.set(this._backgroundSnapshot);
      this.ctx.previewLayerOnGPU(this._floating.layerId, this._floating.background);
    }
    this._backgroundSnapshot = null;
    this.layerId = null; this.layerBuf = null; this.pixels = [];
    this.ctx.setSelectionDragOffset(null);
    this.ctx.clearScratch();
    return;
  }
  if (!this.active && this._floating) {
    // Cancel entire float: restore original GPU state and selection
    const { layerId, originalLayerBuf, originalSelection } = this._floating;
    this.ctx.previewLayerOnGPU(layerId, originalLayerBuf);
    if (originalSelection) this.ctx.setSelection(originalSelection);
    else this.ctx.clearSelection();
    this._floating = null;
    this._backgroundSnapshot = null;
    this.ctx.clearScratch();
    return;
  }
  // No float — existing non-floating cancel behaviour
  if (this.active && this.layerId && this.layerBuf) {
    this.ctx.previewLayerOnGPU(this.layerId, this.layerBuf);
  }
  this.active = false;
  this.layerId = null; this.layerBuf = null; this._previewBuf = null;
  this.pixels = [];
  this.ctx.setSelectionDragOffset(null);
  this.ctx.clearScratch();
}
```

**Acceptance:**
- `pnpm typecheck` passes.
- Moving a selection once: pixels lift off, drag works, drop shows moved pixels without a DrawCommand commit.
- Moving the same selection a second time: ambient pixel at the first drop position is revealed; ambient at the new destination is hidden.
- Tool switch commits; Escape (no drag) cancels and restores.

---

## Task 5 — Implement floating-state machine in `MarqueeTool` (move mode)
**File:** `src/core/tools/MarqueeTool.ts`

Apply the same pattern as Task 4 to `MarqueeTool`'s internal move mode (`moving` state). Fields, `_updateMovePreview`, `onPointerUp` (move branch), `commitFloating`, `onDeactivate`, and `onCancel` all follow the same design. Key differences:
- Field names use `move` prefix (`_floating`, `_backgroundSnapshot` match names used in Task 4 — no prefix difference needed since MarqueeTool has no outer `_floating` from task 4).
- `onPointerDown`: when **not** `insideSel` (user clicked outside the current selection), call `this.commitFloating()` before proceeding to the new-selection draw path. This ensures the float is committed before a new selection starts.
- The `_updateMovePreview` method already exists in `MarqueeTool`; update its `orig` reference from `this.moveLayerBuf` to `this._floating?.originalLayerBuf ?? this.moveLayerBuf!`.

**Acceptance:** Same behavioural checks as Task 4 but using the MarqueeTool's internal move mode (click inside committed selection and drag).

---

## Task 6 — Add `commitFloatingSelection()` calls in `selectionActions`
**File:** `src/state/action-composers/selectionActions.ts`

Import `commitFloatingSelection` from `toolBridge`. Call it at the top of each function that would conflict with an active floating selection:
- `deselect()` — commits then clears selection
- `deleteSelection()` — commits then deletes
- `cutSelection()` — commits then cuts
- `selectAll()` — commits then selects all

`copySelection()` and `pasteSelection()` do not need it (copy is read-only; paste creates a new selection which doesn't interact with an existing float).

**Acceptance:** `pnpm typecheck` passes; no circular import errors (toolBridge is in `state/`, selectionActions is in `state/action-composers/` — same layer, no violation).

---

## Task 7 — Build and verify
**Files:** run commands only

```
pnpm typecheck
pnpm build
pnpm test
```

Report any failures. All three must pass before this task is marked complete.

**Acceptance:** Zero type errors, zero build errors, zero test regressions.

---

## Dependency graph

```
Task 1 → Task 2 → Task 3 → Task 6
Task 1 → Task 4
Task 4 → Task 5
Tasks 4, 5, 6 → Task 7
```
