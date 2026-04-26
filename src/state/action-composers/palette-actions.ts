import type { RGBA, Swatch, ImportedSwatch } from '../../core/DataModel';
import { makeSwatch, parsePaletteFile } from '../../core/DataModel';
import {
  AddSwatchCommand,
  RemoveSwatchCommand,
  UpdateSwatchCommand,
  MoveSwatchCommand,
  type PaletteCommandDeps,
} from '../../core/commands/PaletteCommands';
import { usePaletteStore } from '../usePaletteStore';
import { useHistoryStore } from '../useHistoryStore';

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
