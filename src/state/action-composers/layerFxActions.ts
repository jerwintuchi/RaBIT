import { readPixel } from '../../core/DataModel';
import { DrawCommand, type PixelDelta } from '../../core/commands/DrawCommand';
import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';
import { useProjectStore } from '../useProjectStore';
import { usePaletteStore } from '../usePaletteStore';
import { useHistoryStore } from '../useHistoryStore';
import { getEngine, uploadLayerData, DirtyFlag } from '../renderBridge';
import { resolveCell } from './frame-utils';

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

function notifyChanged(id: string, d: Uint8ClampedArray): void {
  uploadLayerData(id, d);
  getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
  useLayerStore.getState().bumpDataVersion(id);
}

/**
 * Adds a 1px outline around all opaque pixels on the active layer using the
 * current primary color. Transparent pixels adjacent (4-directional) to any
 * opaque pixel are filled. Existing opaque pixels are never overwritten.
 */
export function outlineLayer(): void {
  const { activeLayerId, layers } = useLayerStore.getState();
  if (!activeLayerId) return;
  if (layers.find((l) => l.id === activeLayerId)?.locked) return;

  const { frames, activeFrameIndex } = useFrameStore.getState();
  const buf = resolveCell(frames, activeFrameIndex, activeLayerId);
  if (!buf) return;

  const { canvas } = useProjectStore.getState();
  const { width: w, height: h } = canvas;
  const color = usePaletteStore.getState().primaryColor;

  const deltas: PixelDelta[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pixel = readPixel(buf, x, y, w);
      if ((pixel & 0xff) !== 0) continue; // already opaque — skip

      let hasOpaquNeighbor = false;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if ((readPixel(buf, nx, ny, w) & 0xff) !== 0) {
          hasOpaquNeighbor = true;
          break;
        }
      }

      if (hasOpaquNeighbor) {
        deltas.push({ x, y, before: pixel, after: color });
      }
    }
  }

  if (deltas.length === 0) return;

  const cmd = new DrawCommand(
    activeLayerId,
    deltas,
    buf,
    w,
    notifyChanged,
    'Outline layer',
  );
  useHistoryStore.getState().execute(cmd);
}
