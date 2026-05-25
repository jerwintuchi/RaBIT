# Floating Selection — Design

## Approach

Defer the `DrawCommand` commit until an explicit trigger (tool switch, deselect, Escape). Between drags the moved pixels live in two CPU buffers:

- **`background`** — a mutable copy of the layer with source positions permanently zeroed. Each drag updates it via `_updateMovePreview` (zero new destination, restore previous destination from `originalLayerBuf`). After each drop the floating pixels are written back into `background` so the canvas renders correctly when no drag is in progress.
- **`originalLayerBuf`** — a frozen copy of the layer taken at the moment the float starts. Used as the source-of-truth for restoring original ambient pixel values and for the `DrawCommand.before` deltas at commit time.

Between these two buffers the GPU always shows the correct non-destructive state: source positions empty, current destination showing the moved pixels, every other pixel at its original value — even if the selection has been repositioned multiple times.

---

## Affected Components

| File | Change |
|------|--------|
| `src/core/ToolEngine/types.ts` | Add `onDeactivate?(): void` to `Tool` interface |
| `src/core/ToolEngine/index.ts` | Add `commitPendingOps()` method; call it in `setActiveTool` |
| `src/core/tools/MoveTool.ts` | Full floating-state machine (see below) |
| `src/core/tools/MarqueeTool.ts` | Same floating-state machine for its internal move mode |
| `src/state/toolBridge.ts` | `setActiveTool` calls `commitPendingOps` first; export `commitFloatingSelection()` |

---

## Data Model Changes

### `FloatingState` (private to each tool, not in any store)

```ts
interface FloatingState {
  /** The pixels that are floating (captured at float start, never re-captured). */
  pixels: Array<{ x: number; y: number; color: RGBA }>;
  /** Mutable layer copy: source positions = 0; current destination = floating pixels written in.
   *  Updated incrementally by _updateMovePreview and by each drop. */
  background: Uint8ClampedArray;
  /** Frozen snapshot of the layer at the instant the float started.
   *  Used as the `before` reference for DrawCommand and for restoring original ambient values. */
  originalLayerBuf: Uint8ClampedArray;
  /** Selection active at float start — restored if the float is cancelled. */
  originalSelection: SelectionMask | null;
  layerId: LayerId;
  /** Current offset of floating pixels from their original positions. */
  currentDx: number;
  currentDy: number;
}
```

### `_backgroundSnapshot` (per-drag, not part of FloatingState)

A shallow copy of `background` taken at the start of each drag segment. Used by `onCancel` to restore the background to the pre-drag state so the float can continue from its last committed position.

---

## Key Flows

### Float start (first drag of a new selection)

1. Capture pixels from `selection` mask (same as today).
2. `originalLayerBuf = new Uint8ClampedArray(layerBuf)` — frozen copy.
3. `background = new Uint8ClampedArray(layerBuf)` — mutable copy.
4. Zero each captured pixel's position in `background`.
5. Store in `_floating = { pixels, background, originalLayerBuf, originalSelection: selection, layerId, currentDx: 0, currentDy: 0 }`.
6. Upload `background` to GPU via `previewLayerOnGPU`.
7. Init scratch at offset 0 (show floating pixels at original position).

### Float re-drag (second+ drag while float is active)

`onPointerDown` detects `_floating !== null` (same layerId). Instead of re-capturing from the layer (it has no pixels there):
1. `_backgroundSnapshot = _floating.background.slice()`.
2. Set `_prevMoveDx = _floating.currentDx`, `_prevMoveDy = _floating.currentDy`.
3. Upload `_floating.background` to GPU (already shows floating pixels at `currentDx/Dy`).
4. Init scratch with floating pixels at `currentDx/Dy`.

### `_updateMovePreview` during float

The method signature and step structure stay the same, but `orig` is always `_floating.originalLayerBuf` (not the live frame-store buffer) so that restoring previous destinations always produces the ORIGINAL ambient value, not whatever was last committed.

```
orig = _floating.originalLayerBuf   ← KEY CHANGE from current implementation
```

Steps remain:
1. Restore previous destination footprint from `orig` → reveals original ambient pixel.
2. Re-zero source positions (may have been restored in step 1 if prev-dest overlapped src).
3. Zero new destination footprint → hides new ambient pixel under the floating pixels.

### Float drop (`onPointerUp`)

1. Clear scratch and selection-drag-offset.
2. Compute `(dx, dy)` relative to drag start.
3. Call `_updateMovePreview(dx, dy)` one final time to lock in the background state.
4. **Write floating pixels into `background` at their new position** so the canvas looks correct while no drag is in progress.
5. Upload `background` to GPU.
6. `_floating.currentDx = dx + (accumulated offset from previous segments)` — see note below on absolute offsets.
7. Rebuild selection at the new exact pixel positions (same logic as today).
8. **Do NOT execute a DrawCommand.**

> **Offset accounting**: `currentDx/Dy` represents the TOTAL displacement from the original source positions (not just the last drag segment). After each drop: `_floating.currentDx += segmentDx`, `_floating.currentDy += segmentDy`.

### Float commit (`commitFloating()`)

Called by `onDeactivate`, and from action-composers before clearing the selection.

1. Read live frame-store buffer: `const liveBuf = ctx.getLayerData(layerId)`.
2. Build `deltaMap`:
   - **Erase** each source position: `{ x, y, before: readPixel(liveBuf, x, y, w), after: 0 }`.
   - **Write** each final destination: `{ x: x + currentDx, y: y + currentDy, before: readPixel(liveBuf, fx, fy, w), after: color }`. Handle source-destination overlap same as today.
3. Execute `new DrawCommand(layerId, deltas, liveBuf, w, notifyLayerChanged, 'Move selection')`.
4. Clear `_floating = null`, `_backgroundSnapshot = null`.

> Because no DrawCommand ran during the float, `liveBuf` equals `_floating.originalLayerBuf` (no undo could have modified it in normal operation). The `before` values therefore correctly capture original ambient pixel colours for undo.

### Float cancel (`onCancel`)

Two sub-cases handled by inspecting `this.active`:

**During active drag** (`this.active === true`):
- Stop the drag.
- Restore `_floating.background` from `_backgroundSnapshot` (undo the partial drag).
- Upload `_floating.background` to GPU.
- Clear scratch.
- Do NOT clear `_floating` — the float remains at `currentDx/Dy`.

**Not in a drag but floating** (`this.active === false && _floating !== null`):
- Restore GPU from `_floating.originalLayerBuf` via `previewLayerOnGPU`.
- Restore original selection via `ctx.setSelection(_floating.originalSelection)`.
- Clear `_floating`.
- Clear scratch.

### `onDeactivate` (new Tool method)

Simply calls `commitFloating()` if `_floating !== null`.

---

## Trade-offs

| Decision | Rationale |
|----------|-----------|
| Pixel data stays in the tool (not in Zustand) | Avoids serialising large `Uint8ClampedArray` buffers through reactive state, consistent with existing `_previewBuf` pattern |
| `originalLayerBuf` is a full copy | Ensures `before` deltas are always correct even if re-drags diverge; cost is one extra canvas-sized buffer per active float (~1 MB at 512×512) |
| `_backgroundSnapshot` per drag segment | Enables mid-drag Escape to restore float to last drop position without re-computing from scratch |
| No special undo-during-float handling | Since no DrawCommand runs during the float the live buffer is untouched; pressing undo modifies the base layer while the float is still showing — this creates a visual glitch. Out of scope for this iteration; can be fixed by having the undo action call `commitFloatingSelection()` first. |

---

## Risks

- **Stale `_floating` if layer is deleted**: if the active layer is deleted while a float is pending, `_floating.layerId` points to a removed layer. Mitigation: `onDeactivate` (which commits or cancels the float) must be called before any layer deletion.
- **Two full canvas buffers in memory**: `background` + `originalLayerBuf` each at `width × height × 4` bytes. At 4096×4096 this is ~64 MB each. Acceptable given the memory budget, but noted.
