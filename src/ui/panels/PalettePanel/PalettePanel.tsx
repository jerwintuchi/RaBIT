import { useState, useRef } from 'react';
import { usePaletteStore } from '../../../state/usePaletteStore';
import { paletteActions } from '../../../state/action-composers';
import { rgbaToHex } from '../../../state/colorUtils';
import type { Swatch } from '../../../state/dataModelTypes';
import { ContextMenu, Tooltip } from '../../primitives';
import type { ContextMenuItem } from '../../primitives';
import { IconPlus, IconUpload } from '../../../assets/icons';
import styles from './PalettePanel.module.css';

type SwatchSize = 'S' | 'M' | 'L';
const SIZE_PX: Record<SwatchSize, number> = { S: 16, M: 20, L: 28 };

interface MenuState {
  index: number;
  swatch: Swatch;
  anchor: { x: number; y: number };
}

export function PalettePanel(): JSX.Element {
  const swatches = usePaletteStore((s) => s.palette.swatches);
  const indexedMode = usePaletteStore((s) => s.indexedMode);

  const [size, setSize] = useState<SwatchSize>('M');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [gridMenu, setGridMenu] = useState<{ x: number; y: number } | null>(null);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickPrimary = (color: number) => {
    usePaletteStore.getState().pushColorHistory(usePaletteStore.getState().primaryColor);
    usePaletteStore.getState().setPrimaryColor(color);
  };

  const onContextMenu = (e: React.MouseEvent, index: number, swatch: Swatch) => {
    e.preventDefault();
    setMenu({ index, swatch, anchor: { x: e.clientX, y: e.clientY } });
  };

  const commitRename = () => {
    if (renamingIndex === null) return;
    const trimmed = renameValue.trim();
    paletteActions.renameSwatch(renamingIndex, trimmed || null);
    setRenamingIndex(null);
  };

  // ── Drag-to-reorder ─────────────────────────────────────────────────────

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDragSrc(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  };

  const onDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragSrc !== null && dragSrc !== toIndex) {
      paletteActions.moveSwatch(dragSrc, toIndex);
    }
    setDragSrc(null);
    setDragOver(null);
  };

  const onDragEnd = () => {
    setDragSrc(null);
    setDragOver(null);
  };

  // ── Import ───────────────────────────────────────────────────────────────

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        paletteActions.importSwatches(file.name, text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Context menu items ───────────────────────────────────────────────────

  const swatchMenuItems: ContextMenuItem[] = menu
    ? [
        {
          type: 'item',
          label: 'Set as primary',
          onClick: () => onPickPrimary(menu.swatch.color),
        },
        {
          type: 'item',
          label: 'Set as secondary',
          onClick: () => usePaletteStore.getState().setSecondaryColor(menu.swatch.color),
        },
        {
          type: 'item',
          label: 'Replace with primary color',
          onClick: () =>
            paletteActions.updateSwatchColor(
              menu.index,
              usePaletteStore.getState().primaryColor,
            ),
        },
        {
          type: 'item',
          label: 'Rename…',
          onClick: () => {
            setRenameValue(menu.swatch.name ?? '');
            setRenamingIndex(menu.index);
          },
        },
        { type: 'separator' },
        {
          type: 'item',
          label: 'Delete swatch',
          danger: true,
          onClick: () => paletteActions.removeSwatch(menu.index),
        },
      ]
    : [];

  const gridMenuItems: ContextMenuItem[] = [
    {
      type: 'item',
      label: 'Replace palette from canvas',
      onClick: () => {
        if (window.confirm('Replace the palette with canvas colors?')) {
          paletteActions.buildFromCanvas('replace');
        }
      },
    },
    {
      type: 'item',
      label: 'Append canvas colors to palette',
      onClick: () => paletteActions.buildFromCanvas('append'),
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Palette</span>
        <div className={styles.headerActions}>
          <div className={styles.sizeToggle} role="radiogroup" aria-label="Swatch size">
            {(['S', 'M', 'L'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={size === s}
                className={`${styles.sizeOption} ${size === s ? styles.sizeOptionActive : ''}`}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <Tooltip content="Import palette (GPL / CSV / hex)" placement="left">
            <button
              type="button"
              className={styles.headerButton}
              aria-label="Import palette"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload />
            </button>
          </Tooltip>
          <Tooltip content="Indexed color mode — paint snaps to nearest swatch" placement="left">
            <button
              type="button"
              className={`${styles.headerButton} ${indexedMode ? styles.headerButtonActive : ''}`}
              aria-label="Indexed color mode"
              aria-pressed={indexedMode}
              onClick={() => usePaletteStore.getState().setIndexedMode(!indexedMode)}
            >
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '-0.5px' }}>IDX</span>
            </button>
          </Tooltip>
          <Tooltip content="Add swatch from primary color" placement="left">
            <button
              type="button"
              className={styles.headerButton}
              aria-label="Add swatch"
              onClick={() => paletteActions.addSwatchFromPrimary()}
            >
              <IconPlus />
            </button>
          </Tooltip>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".gpl,.csv,.txt,.hex"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />

      <div
        className={styles.grid}
        style={{ '--swatch-size': `${SIZE_PX[size]}px` } as React.CSSProperties}
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          setGridMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {swatches.map((sw, idx) => {
          const isDragSrc = dragSrc === idx;
          const isDragTarget = dragOver === idx && dragSrc !== idx;

          if (renamingIndex === idx) {
            return (
              <input
                key={`rename-${idx}`}
                className={styles.renameInput}
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingIndex(null);
                }}
              />
            );
          }

          return (
            <Tooltip
              key={`${idx}-${sw.color}`}
              content={sw.name ?? rgbaToHex(sw.color)}
              placement="top"
            >
              <button
                type="button"
                draggable
                className={`${styles.swatch} ${isDragSrc ? styles.swatchDragging : ''} ${isDragTarget ? styles.swatchDropTarget : ''}`}
                style={{ background: rgbaToHex(sw.color) }}
                aria-label={sw.name ?? `Swatch ${rgbaToHex(sw.color)}`}
                onClick={() => onPickPrimary(sw.color)}
                onContextMenu={(e) => onContextMenu(e, idx, sw)}
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={(e) => onDrop(e, idx)}
                onDragEnd={onDragEnd}
              />
            </Tooltip>
          );
        })}
        {swatches.length === 0 && (
          <Tooltip
            content="Right-click here to replace or append canvas colors to the palette"
            placement="top"
          >
            <span className={styles.empty}>Click + to add the primary color</span>
          </Tooltip>
        )}
      </div>

      {menu && (
        <ContextMenu
          items={swatchMenuItems}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
        />
      )}
      {gridMenu && (
        <ContextMenu
          items={gridMenuItems}
          anchor={gridMenu}
          onClose={() => setGridMenu(null)}
        />
      )}
    </div>
  );
}
