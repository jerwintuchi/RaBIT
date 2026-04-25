import type { Frame, LayerId } from '../../core/DataModel';

/** Resolves a linked cell backward to the nearest non-linked frame's data. */
export function resolveCell(
  frames: Frame[],
  frameIndex: number,
  layerId: LayerId,
): Uint8ClampedArray | null {
  let idx = frameIndex;
  while (idx >= 0) {
    const cell = frames[idx]?.cells[layerId];
    if (!cell) return null;
    if (!cell.linked) return cell.data;
    idx--;
  }
  return null;
}
