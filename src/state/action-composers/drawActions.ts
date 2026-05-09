import type { RGBA } from '../../core/DataModel';
import { readPixel } from '../../core/DataModel';
import { DrawCommand, type PixelDelta } from '../../core/commands/DrawCommand';
import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';
import { useProjectStore } from '../useProjectStore';
import { usePaletteStore } from '../usePaletteStore';
import { useHistoryStore } from '../useHistoryStore';
import { useToolStore, type SelectionMask } from '../useToolStore';
import { getEngine, uploadLayerData, DirtyFlag } from '../renderBridge';
import { resolveCell } from './frame-utils';

function resolveActiveLayer(): {
  layerId: string;
  buf: Uint8ClampedArray;
  w: number;
  h: number;
} | null {
  const { activeLayerId, layers } = useLayerStore.getState();
  if (!activeLayerId) return null;
  if (layers.find((l) => l.id === activeLayerId)?.locked) return null;
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const buf = resolveCell(frames, activeFrameIndex, activeLayerId);
  if (!buf) return null;
  const { canvas } = useProjectStore.getState();
  return { layerId: activeLayerId, buf, w: canvas.width, h: canvas.height };
}

function notifyChanged(id: string, d: Uint8ClampedArray): void {
  uploadLayerData(id, d);
  getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
  useLayerStore.getState().bumpDataVersion(id);
}

/** Iterate every pixel that is "targeted" by the selection (respects inverted flag). */
function forEachTargetPixel(
  sel: SelectionMask,
  w: number,
  h: number,
  cb: (x: number, y: number) => void,
): void {
  const { bounds, data, inverted } = sel;
  if (inverted) {
    // Inverted: every canvas pixel OUTSIDE the selection bounds is targeted,
    // plus pixels inside bounds where the mask bit is 0.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inBounds =
          x >= bounds.x && x < bounds.x + bounds.w &&
          y >= bounds.y && y < bounds.y + bounds.h;
        const inside = inBounds && data[y * sel.width + x] === 1;
        if (!inside) cb(x, y);
      }
    }
  } else {
    // Normal: only pixels inside the selection bounds where mask bit is 1.
    for (let y = bounds.y; y < bounds.y + bounds.h && y < h; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.w && x < w; x++) {
        if (data[y * sel.width + x] === 1) cb(x, y);
      }
    }
  }
}

/**
 * Erase (set to transparent) all pixels within the current selection on the
 * active layer. No-op if no committed selection is active.
 */
export function eraseSelection(): void {
  const sel = useToolStore.getState().selection;
  if (!sel || sel.data.length <= 1) return;

  const ctx = resolveActiveLayer();
  if (!ctx) return;
  const { layerId, buf, w, h } = ctx;

  const deltas: PixelDelta[] = [];
  forEachTargetPixel(sel, w, h, (x, y) => {
    const before = readPixel(buf, x, y, w);
    if ((before & 0xff) !== 0) deltas.push({ x, y, before, after: 0 });
  });

  if (deltas.length === 0) return;
  useHistoryStore.getState().execute(
    new DrawCommand(layerId, deltas, buf, w, notifyChanged, 'Erase selection'),
  );
}

/**
 * Fill all pixels within the current selection with the given RGBA colour on
 * the active layer. Omit rgba to use the current primary colour.
 */
export function fillSelection(rgba?: RGBA): void {
  const sel = useToolStore.getState().selection;
  if (!sel || sel.data.length <= 1) return;

  const ctx = resolveActiveLayer();
  if (!ctx) return;
  const { layerId, buf, w, h } = ctx;

  const color: RGBA = rgba ?? usePaletteStore.getState().primaryColor;

  const deltas: PixelDelta[] = [];
  forEachTargetPixel(sel, w, h, (x, y) => {
    const before = readPixel(buf, x, y, w);
    if (before !== color) deltas.push({ x, y, before, after: color });
  });

  if (deltas.length === 0) return;
  useHistoryStore.getState().execute(
    new DrawCommand(layerId, deltas, buf, w, notifyChanged, 'Fill selection'),
  );
}
