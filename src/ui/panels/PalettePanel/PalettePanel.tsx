import { useState } from 'react';
import { usePaletteStore } from '../../../state/usePaletteStore';
import { paletteActions } from '../../../state/action-composers';
import { rgbaToHex } from '../../../state/colorUtils';
import type { Swatch } from '../../../state/dataModelTypes';
import { ContextMenu, Tooltip } from '../../primitives';
import type { ContextMenuItem } from '../../primitives';
import { IconPlus } from '../../../assets/icons';
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
  const [size, setSize] = useState<SwatchSize>('M');
  const [menu, setMenu] = useState<MenuState | null>(null);

  const onPickPrimary = (color: number) => {
    usePaletteStore.getState().setPrimaryColor(color);
  };

  const onContextMenu = (e: React.MouseEvent, index: number, swatch: Swatch) => {
    e.preventDefault();
    setMenu({ index, swatch, anchor: { x: e.clientX, y: e.clientY } });
  };

  const menuItems: ContextMenuItem[] = menu
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
        { type: 'separator' },
        {
          type: 'item',
          label: 'Delete swatch',
          danger: true,
          onClick: () => paletteActions.removeSwatch(menu.index),
        },
      ]
    : [];

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

      <div
        className={styles.grid}
        style={{ '--swatch-size': `${SIZE_PX[size]}px` } as React.CSSProperties}
      >
        {swatches.map((sw, idx) => (
          <Tooltip
            key={`${idx}-${sw.color}`}
            content={sw.name ?? rgbaToHex(sw.color)}
            placement="top"
          >
            <button
              type="button"
              className={styles.swatch}
              style={{ background: rgbaToHex(sw.color) }}
              aria-label={sw.name ?? `Swatch ${rgbaToHex(sw.color)}`}
              onClick={() => onPickPrimary(sw.color)}
              onContextMenu={(e) => onContextMenu(e, idx, sw)}
            />
          </Tooltip>
        ))}
        {swatches.length === 0 && (
          <span className={styles.empty}>Click + to save the primary color</span>
        )}
      </div>

      {menu && (
        <ContextMenu
          items={menuItems}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
