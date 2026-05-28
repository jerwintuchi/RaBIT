import { useUIStore } from '../../state/useUIStore';
import { useHistoryStore } from '../../state/useHistoryStore';
import { canvasActions, selectionActions, layerFxActions, paletteActions } from '../../state/action-composers';
import { useToolStore } from '../../state/useToolStore';
import { usePaletteStore } from '../../state/usePaletteStore';
import { useDropdownMenu } from './useDropdownMenu';
import { MenuItem } from './FileMenu';
import styles from './FileMenu.module.css';

export function EditMenu() {
  const { open, setOpen, close, triggerRef, dropdownRef, getDropdownPos } = useDropdownMenu();

  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());
  const hasSelection = useToolStore((s) => s.selection !== null && s.selection.data.length > 1);
  const hasClipboard = useToolStore((s) => s.selectionClipboard !== null);
  const hasPalette = usePaletteStore((s) => s.palette.swatches.length > 0);

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
            label="Select All"
            shortcut="Ctrl+A"
            onClick={() => { close(); selectionActions.selectAll(); }}
          />
          <MenuItem
            label="Deselect"
            shortcut="Ctrl+D"
            disabled={!hasSelection}
            onClick={() => { close(); selectionActions.deselect(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Cut"
            shortcut="Ctrl+X"
            disabled={!hasSelection}
            onClick={() => { close(); selectionActions.cutSelection(); }}
          />
          <MenuItem
            label="Copy"
            shortcut="Ctrl+C"
            disabled={!hasSelection}
            onClick={() => { close(); selectionActions.copySelection(); }}
          />
          <MenuItem
            label="Paste"
            shortcut="Ctrl+V"
            disabled={!hasClipboard}
            onClick={() => { close(); void selectionActions.pasteSelection(); }}
          />
          <MenuItem
            label="Delete Selection"
            shortcut="Delete"
            disabled={!hasSelection}
            onClick={() => { close(); selectionActions.deleteSelection(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Preferences..."
            shortcut="Ctrl+,"
            onClick={() => { close(); useUIStore.getState().showPrefsDialog(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Flip Horizontal"
            onClick={() => { close(); canvasActions.flipLayer('h'); }}
          />
          <MenuItem
            label="Flip Vertical"
            onClick={() => { close(); canvasActions.flipLayer('v'); }}
          />
          <MenuItem
            label="Rotate 90 CW"
            onClick={() => { close(); void canvasActions.rotateLayer('cw'); }}
          />
          <MenuItem
            label="Rotate 90 CCW"
            onClick={() => { close(); void canvasActions.rotateLayer('ccw'); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Outline Layer"
            onClick={() => { close(); layerFxActions.outlineLayer(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Quantize to Palette"
            disabled={!hasPalette}
            onClick={() => { close(); paletteActions.quantizeToPalette(); }}
          />
        </div>
      )}
    </>
  );
}
