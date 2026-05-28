import type { RGBA, Swatch, ImportedSwatch } from '../../core/DataModel';
import { makeSwatch, makePalette, parsePaletteFile, nearestSwatchColor, readPixel } from '../../core/DataModel';
import { useFrameStore } from '../useFrameStore';
import { useLayerStore } from '../useLayerStore';
import { useProjectStore } from '../useProjectStore';
import { resolveCell } from './frame-utils';
import {
  AddSwatchCommand,
  RemoveSwatchCommand,
  UpdateSwatchCommand,
  MoveSwatchCommand,
  QuantizeToPaletteCommand,
  type PaletteCommandDeps,
} from '../../core/commands/PaletteCommands';
import { usePaletteStore } from '../usePaletteStore';
import { useHistoryStore } from '../useHistoryStore';
import { getEngine, uploadLayerData, DirtyFlag } from '../renderBridge';

let _deps: PaletteCommandDeps | null = null;

function getDeps(): PaletteCommandDeps {
  if (_deps) return _deps;
  _deps = {
    insertSwatch: (swatch, index) =>
      usePaletteStore.setState((s) => {
        s.palette.swatches.splice(index, 0, swatch);
      }),
    removeSwatch: (index) =>
      usePaletteStore.setState((s) => {
        s.palette.swatches.splice(index, 1);
      }),
    patchSwatch: (index, patch) =>
      usePaletteStore.setState((s) => {
        const sw = s.palette.swatches[index];
        if (sw) Object.assign(sw, patch);
      }),
    reorderSwatches: (fromIndex, toIndex) =>
      usePaletteStore.getState().reorderSwatches(fromIndex, toIndex),
  };
  return _deps;
}

// ── Public actions ─────────────────────────────────────────────────────────

export function addSwatchFromPrimary(): void {
  const { primaryColor, palette } = usePaletteStore.getState();
  const swatch = makeSwatch(primaryColor);
  useHistoryStore
    .getState()
    .execute(new AddSwatchCommand(swatch, palette.swatches.length, getDeps()));
}

export function addSwatch(color: RGBA, name?: string | null, atIndex?: number): void {
  const { palette } = usePaletteStore.getState();
  const swatch = makeSwatch(color, name ?? null);
  const idx = atIndex ?? palette.swatches.length;
  useHistoryStore.getState().execute(new AddSwatchCommand(swatch, idx, getDeps()));
}

export function removeSwatch(index: number): void {
  const { palette } = usePaletteStore.getState();
  const swatch = palette.swatches[index];
  if (!swatch) return;
  // Snapshot a copy so the undo is independent of subsequent edits
  const copy: Swatch = { color: swatch.color, name: swatch.name };
  useHistoryStore.getState().execute(new RemoveSwatchCommand(index, copy, getDeps()));
}

export function updateSwatchColor(index: number, color: RGBA): void {
  const { palette } = usePaletteStore.getState();
  const sw = palette.swatches[index];
  if (!sw || sw.color === color) return;
  useHistoryStore
    .getState()
    .execute(
      new UpdateSwatchCommand(
        index,
        { color: sw.color },
        { color },
        getDeps(),
        'Change swatch color',
      ),
    );
}

export function moveSwatch(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  useHistoryStore.getState().execute(new MoveSwatchCommand(fromIndex, toIndex, getDeps()));
}

export function importSwatches(filename: string, text: string): void {
  const items: ImportedSwatch[] = parsePaletteFile(filename, text);
  if (items.length === 0) return;
  const { palette } = usePaletteStore.getState();
  let insertAt = palette.swatches.length;
  for (const item of items) {
    const swatch = makeSwatch(item.color, item.name ?? null);
    useHistoryStore.getState().execute(new AddSwatchCommand(swatch, insertAt, getDeps()));
    insertAt++;
  }
}

// ── Canvas color extraction ────────────────────────────────────────────────

function collectCanvasColors(): number[] {
  const { layers } = useLayerStore.getState();
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const seen = new Set<number>();
  for (const layer of layers) {
    if (!layer.visible) continue;
    const buf = resolveCell(frames, activeFrameIndex, layer.id);
    if (!buf) continue;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] === 0) continue;
      const rgba = (((buf[i]! << 24) | (buf[i + 1]! << 16) | (buf[i + 2]! << 8) | buf[i + 3]!) >>> 0) as number;
      seen.add(rgba);
    }
  }
  return Array.from(seen);
}

/** Count unique non-transparent colors across all visible layers of the active frame. */
export function countCanvasColors(): number {
  return collectCanvasColors().length;
}

/**
 * Build the palette from canvas colors.
 * - `replace`: clears the palette and fills it with the canvas colors.
 * - `append`: adds only colors not already present in the palette.
 */
export function buildFromCanvas(mode: 'replace' | 'append'): void {
  const colors = collectCanvasColors();
  if (colors.length === 0) return;
  const store = usePaletteStore.getState();
  if (mode === 'replace') {
    store.setPalette({ ...makePalette({ name: store.palette.name }), swatches: colors.map((c) => makeSwatch(c)) });
    return;
  }
  const existingColors = new Set(store.palette.swatches.map((s) => s.color));
  for (const c of colors) {
    if (!existingColors.has(c)) store.addSwatch(c);
  }
}

export function quantizeToPalette(): void {
  const { palette } = usePaletteStore.getState();
  if (palette.swatches.length === 0) return;
  const { layers } = useLayerStore.getState();
  const { frames, activeFrameIndex } = useFrameStore.getState();
  const { width } = useProjectStore.getState().canvas;

  const notifyLayer = (id: string, data: Uint8ClampedArray) => {
    uploadLayerData(id, data);
    getEngine()?.markDirty(DirtyFlag.LAYER_DATA);
    useLayerStore.getState().bumpDataVersion(id);
  };

  const ops = [];
  for (const layer of layers) {
    if (layer.locked) continue;
    const buf = resolveCell(frames, activeFrameIndex, layer.id);
    if (!buf) continue;
    const pixelCount = buf.length / 4;
    const deltas: Array<{ offset: number; before: RGBA; after: RGBA }> = [];
    for (let p = 0; p < pixelCount; p++) {
      if (buf[p * 4 + 3] === 0) continue;
      const before = readPixel(buf, p % width, (p / width) | 0, width);
      const after = nearestSwatchColor(before, palette.swatches);
      if (before !== after) deltas.push({ offset: p, before, after });
    }
    if (deltas.length > 0) ops.push({ layerId: layer.id, deltas, buf, width, notify: notifyLayer });
  }

  if (ops.length === 0) return;
  useHistoryStore.getState().execute(new QuantizeToPaletteCommand(ops));
}

export function renameSwatch(index: number, name: string | null): void {
  const { palette } = usePaletteStore.getState();
  const sw = palette.swatches[index];
  if (!sw || sw.name === name) return;
  useHistoryStore
    .getState()
    .execute(
      new UpdateSwatchCommand(
        index,
        { name: sw.name },
        { name },
        getDeps(),
        'Rename swatch',
      ),
    );
}
