import type { Cell, Frame, LayerId } from '../../core/DataModel';

/** Deep-copies a cell, preserving the linked/unlinked distinction. */
export function cloneCell(cell: Cell): Cell {
  return cell.linked
    ? { linked: true, data: null }
    : { linked: false, data: cell.data ? new Uint8ClampedArray(cell.data) : null };
}

/** Resolves a linked cell backward to the nearest non-linked frame's data. */
export function resolveCell(
  frames: Frame[],
  frameIndex: number,
  layerId: LayerId,
): Uint8ClampedArray | null {
  let idx = frameIndex;
  while (idx >= 0) {
    const frame = frames[idx];
    if (!frame) { idx--; continue; }
    const cell = frame.cells[layerId];
    // No cell for this layer in this frame — skip (layer may have been added after this frame)
    if (!cell) { idx--; continue; }
    if (!cell.linked) return cell.data;
    idx--;
  }
  return null;
}
