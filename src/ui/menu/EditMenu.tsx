import { useUIStore } from '../../state/useUIStore';
import { useHistoryStore } from '../../state/useHistoryStore';
import { useDropdownMenu } from './useDropdownMenu';
import { MenuItem } from './FileMenu';
import styles from './FileMenu.module.css';

export function EditMenu() {
  const { open, setOpen, close, triggerRef, dropdownRef, getDropdownPos } = useDropdownMenu();

  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());

  const pos = open ? getDropdownPos() : { top: 28, left: 0 };

  return (
    <>
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        Edit
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: pos.top, left: pos.left }}
        >
          <MenuItem
            label="Undo"
            shortcut="Ctrl+Z"
            disabled={!canUndo}
            onClick={() => { close(); useHistoryStore.getState().undo(); }}
          />
          <MenuItem
            label="Redo"
            shortcut="Ctrl+Y"
            disabled={!canRedo}
            onClick={() => { close(); useHistoryStore.getState().redo(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Preferences…"
            shortcut="Ctrl+,"
            onClick={() => { close(); useUIStore.getState().showPrefsDialog(); }}
          />
        </div>
      )}
    </>
  );
}
