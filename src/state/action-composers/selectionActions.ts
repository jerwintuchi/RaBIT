/**
 * Selection clipboard actions: copy, cut, paste, delete, selectAll, deselect.
 *
 * System clipboard write is intentionally skipped (TODO: integrate
 * @tauri-apps/plugin-clipboard-manager when available).
 */
import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';
import { useProjectStore } from '../useProjectStore';
import { useHistoryStore } from '../useHistoryStore';
import { useToolStore } from '../useToolStore';
import type { SelectionClipboard } from '../useToolStore';
import { getEngine, uploadLayerData, DirtyFlag } from '../renderBridge';
import { resolveCell } from './frame-utils';
import { PixelBufferCommand, buildDeletedBuffer, buildPastedBuffer } from '../../core/commands/SelectionCommands';
import { commitFloatingSelection } from '../toolBridge';

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

/**
 * Copy selected pixels from the active layer into the in-memory clipboard.
 * Only pixels where the selection mask is 1 are included (others are transparent).
 * Does NOT clear the selection.
 */
export function copySelection(): void {
  const sel = useToolStore.getState().selection;
  if (!sel || sel.data.length <= 1) return;

  const ctx = resolveActiveLayer();
  if (!ctx) return;
  const { buf, w, h } = ctx;

  const { bounds } = sel;
  const clipW = bounds.w;
  const clipH = bounds.h;
  const clipData = new Uint8ClampedArray(clipW * clipH * 4);

  for (let y = bounds.y; y < bounds.y + bounds.h && y < h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w && x < w; x++) {
      if (sel.data[y * sel.width + x] !== 1) continue;
      const si = (y * w + x) * 4;
      const di = ((y - bounds.y) * clipW + (x - bounds.x)) * 4;
      clipData[di] = buf[si]!;
      clipData[di + 1] = buf[si + 1]!;
      clipData[di + 2] = buf[si + 2]!;
      clipData[di + 3] = buf[si + 3]!;
    }
  }

  const clipboard: SelectionClipboard = {
    data: clipData,
    width: clipW,
    height: clipH,
    originX: bounds.x,
    originY: bounds.y,
  };
  useToolStore.getState().setSelectionClipboard(clipboard);

  // TODO: write to system clipboard via @tauri-apps/plugin-clipboard-manager
  // when the plugin is added to package.json and tauri.conf.json.
}

/**
 * Cut: copy selected pixels to clipboard, then erase them from the active layer.
 */
export function cutSelection(): void {
  commitFloatingSelection();
  const sel = useToolStore.getState().selection;
  if (!sel || sel.data.length <= 1) return;

  // Copy first
  copySelection();

  // Then delete
  deleteSelection();
}

/**
 * Paste clipboard pixels onto the active layer at canvas center.
 * Executes a PasteCommand so the action is undoable.
 */
export function pasteSelection(): void {
  const clipboard = useToolStore.getState().selectionClipboard;
  if (!clipboard) return;

  const ctx = resolveActiveLayer();
  if (!ctx) return;
  const { layerId, buf, w, h } = ctx;

  // Paste at canvas center
  const pasteX = Math.floor((w - clipboard.width) / 2);
  const pasteY = Math.floor((h - clipboard.height) / 2);

  const before = buf.slice();
  const after = buildPastedBuffer(
    buf,
    w,
    h,
    clipboard.data,
    clipboard.width,
    clipboard.height,
    pasteX,
    pasteY,
  );

  const cmd = new PixelBufferCommand(
    'Paste',
    layerId,
    buf,
    before,
    after,
    notifyChanged,
  );
  useHistoryStore.getState().execute(cmd);

  // Set a new selection around the pasted area
  const pasteW = Math.min(clipboard.width, w - pasteX);
  const pasteH = Math.min(clipboard.height, h - pasteY);
  const mask = new Uint8ClampedArray(w * h);
  for (let y = pasteY; y < pasteY + pasteH; y++) {
    for (let x = pasteX; x < pasteX + pasteW; x++) {
      mask[y * w + x] = 1;
    }
  }
  useToolStore.getState().setSelection({
    data: mask,
    width: w,
    height: h,
    bounds: { x: pasteX, y: pasteY, w: pasteW, h: pasteH },
  });
}

/**
 * Delete (erase) selected pixels on the active layer.
 * Executes a DeleteSelectionCommand so the action is undoable.
 */
export function deleteSelection(): void {
  commitFloatingSelection();
  const sel = useToolStore.getState().selection;
  if (!sel || sel.data.length <= 1) return;

  const ctx = resolveActiveLayer();
  if (!ctx) return;
  const { layerId, buf, w, h } = ctx;

  const before = buf.slice();
  const after = buildDeletedBuffer(buf, sel.data, sel.width, w, h);

  const cmd = new PixelBufferCommand(
    'Delete selection',
    layerId,
    buf,
    before,
    after,
    notifyChanged,
  );
  useHistoryStore.getState().execute(cmd);
}

/**
 * Select all pixels on the canvas.
 */
export function selectAll(): void {
  commitFloatingSelection();
  const { canvas } = useProjectStore.getState();
  const { width: w, height: h } = canvas;
  const mask = new Uint8ClampedArray(w * h);
  mask.fill(1);
  useToolStore.getState().setSelection({
    data: mask,
    width: w,
    height: h,
    bounds: { x: 0, y: 0, w, h },
  });
}

/**
 * Clear the active selection.
 */
export function deselect(): void {
  commitFloatingSelection();
  useToolStore.getState().clearSelection();
}
