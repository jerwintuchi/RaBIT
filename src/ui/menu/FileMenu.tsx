import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ipcLoadReferenceImage } from '../../bridge/referenceIpc';
import { useProjectStore } from '../../state/useProjectStore';
import { useReferenceStore } from '../../state/useReferenceStore';
import { toast, useUIStore } from '../../state/useUIStore';
import { fileActions } from '../../state/action-composers';
import { useDropdownMenu } from './useDropdownMenu';
import styles from './FileMenu.module.css';

async function addReferenceImage(): Promise<void> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (typeof selected !== 'string') return;
  try {
    const result = await ipcLoadReferenceImage(selected);
    const pixels = new Uint8ClampedArray(result.pixels);
    useReferenceStore.getState().setImage(selected, pixels, result.width, result.height);
    useProjectStore.getState().setReferencePath(selected);
    toast.info('Reference image loaded');
  } catch (e) {
    toast.error(`Failed to load reference image: ${String(e)}`);
  }
}

export function FileMenu() {
  const { open, setOpen, close, triggerRef, dropdownRef, getDropdownPos } = useDropdownMenu();

  const dirty = useProjectStore((s) => s.meta.dirty);
  const filePath = useProjectStore((s) => s.meta.filePath);
  const hasProject = useProjectStore((s) => s.meta.projectId !== null);
  const recentFiles = useUIStore((s) => s.recentFiles);

  const pos = open ? getDropdownPos() : { top: 28, left: 0 };

  return (
    <>
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        File
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: pos.top, left: pos.left }}
        >
          <MenuItem
            label="New"
            shortcut="Ctrl+N"
            onClick={() => { close(); useUIStore.getState().showNewProjectDialog(); }}
          />
          <MenuItem
            label="Open…"
            shortcut="Ctrl+O"
            onClick={() => { close(); void fileActions.openProject(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Save"
            shortcut="Ctrl+S"
            disabled={!dirty && !!filePath}
            onClick={() => { close(); void fileActions.saveProject(); }}
          />
          <MenuItem
            label="Save As…"
            shortcut="Ctrl+Shift+S"
            onClick={() => { close(); void fileActions.saveProjectAs(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Export…"
            shortcut="Ctrl+E"
            disabled={!hasProject}
            onClick={() => { close(); useUIStore.getState().showExportDialog(); }}
          />
          <MenuItem
            label="Add Reference Image…"
            disabled={!hasProject}
            onClick={() => { close(); void addReferenceImage(); }}
          />

          <div className={styles.separator} />

          {recentFiles.length === 0 ? (
            <span className={styles.sectionLabel}>No Recent Files</span>
          ) : (
            <>
              <span className={styles.sectionLabel}>Recent</span>
              {recentFiles.map((f) => (
                <MenuItem
                  key={f.path}
                  label={f.name}
                  sublabel={f.path}
                  missing={f.missing}
                  onClick={() => {
                    if (f.missing) return;
                    close();
                    void fileActions.openProjectAt(f.path);
                  }}
                />
              ))}
              <div className={styles.separator} />
              <MenuItem
                label="Clear Recent Files"
                muted
                onClick={() => { close(); void fileActions.clearRecentFiles(); }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

interface MenuItemProps {
  label: string;
  shortcut?: string;
  sublabel?: string;
  disabled?: boolean;
  missing?: boolean;
  muted?: boolean;
  onClick?: () => void;
}

export function MenuItem({ label, shortcut, sublabel, disabled, missing, muted, onClick }: MenuItemProps) {
  const cls = [styles.item, missing && styles.missing, muted && styles.itemMuted]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} disabled={disabled} onClick={onClick}>
      <span className={styles.itemInner}>
        <span>{label}</span>
        {sublabel && <span className={styles.itemSublabel}>{sublabel}</span>}
      </span>
      {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
    </button>
  );
}
