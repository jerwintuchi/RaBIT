import { useUIStore } from '../../state/useUIStore';
import { useNineSliceStore } from '../../state/useNineSliceStore';
import { MenuItem } from './FileMenu';
import { useDropdownMenu } from './useDropdownMenu';
import styles from './FileMenu.module.css';

export function ViewMenu() {
  const { open, setOpen, close, triggerRef, dropdownRef, getDropdownPos } = useDropdownMenu();

  const tileMode = useUIStore((s) => s.tileMode);
  const showGrid = useUIStore((s) => s.showGrid);
  const showCheckerboard = useUIStore((s) => s.showCheckerboard);
  const nineSliceVisible = useNineSliceStore((s) => s.visible);

  const pos = open ? getDropdownPos() : { top: 28, left: 0 };

  return (
    <>
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        View
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: pos.top, left: pos.left }}
        >
          <MenuItemCheck
            label="Tile Mode"
            shortcut="T"
            checked={tileMode}
            onClick={() => {
              close();
              useUIStore.getState().setTileMode(!tileMode);
            }}
          />
          <MenuItemCheck
            label="Nine-Slice Preview"
            checked={nineSliceVisible}
            onClick={() => {
              close();
              useNineSliceStore.getState().setVisible(!nineSliceVisible);
            }}
          />

          <div className={styles.separator} />

          <MenuItemCheck
            label="Show Grid"
            checked={showGrid}
            onClick={() => {
              close();
              useUIStore.getState().setShowGrid(!showGrid);
            }}
          />
          <MenuItemCheck
            label="Show Checkerboard"
            checked={showCheckerboard}
            onClick={() => {
              close();
              useUIStore.getState().setShowCheckerboard(!showCheckerboard);
            }}
          />
        </div>
      )}
    </>
  );
}

interface MenuItemCheckProps {
  label: string;
  shortcut?: string;
  checked: boolean;
  onClick: () => void;
}

function MenuItemCheck({ label, shortcut, checked, onClick }: MenuItemCheckProps) {
  const displayLabel = checked ? `✓ ${label}` : `   ${label}`;
  return shortcut !== undefined ? (
    <MenuItem
      label={displayLabel}
      shortcut={shortcut}
      onClick={onClick}
    />
  ) : (
    <MenuItem
      label={displayLabel}
      onClick={onClick}
    />
  );
}
