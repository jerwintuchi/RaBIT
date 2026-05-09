import { useProjectStore } from '../../state/useProjectStore';
import { useUIStore } from '../../state/useUIStore';
import { fileActions } from '../../state/action-composers';
import { useDropdownMenu } from './useDropdownMenu';
import styles from './FileMenu.module.css';

export function FileMenu() {
  const { open, setOpen, close, triggerRef, dropdownRef, getDropdownPos } = useDropdownMenu();

  const dirty = useProjectStore((s) => s.meta.dirty);
  const filePath = useProjectStore((s) => s.meta.filePath);
  const hasProject = useProjectStore((s) => s.meta.projectId !== null);
  const recentFiles = useUIStore((s) => s.recentFiles);
  const showNewProjectDialog = useUIStore((s) => s.showNewProjectDialog);
  const showExportDialog = useUIStore((s) => s.showExportDialog);

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
            onClick={() => { close(); showNewProjectDialog(); }}
          />
          <MenuItem
            label="Open…"
            shortcut="Ctrl+O"
            onClick={() => { close(); fileActions.openProject(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Save"
            shortcut="Ctrl+S"
            disabled={!dirty && !!filePath}
            onClick={() => { close(); fileActions.saveProject(); }}
          />
          <MenuItem
            label="Save As…"
            shortcut="Ctrl+Shift+S"
            onClick={() => { close(); fileActions.saveProjectAs(); }}
          />

          <div className={styles.separator} />

          <MenuItem
            label="Export…"
            shortcut="Ctrl+E"
            disabled={!hasProject}
            onClick={() => { close(); showExportDialog(); }}
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
                    fileActions.openProjectAt(f.path);
                  }}
                />
              ))}
              <div className={styles.separator} />
              <MenuItem
                label="Clear Recent Files"
                muted
                onClick={() => { close(); fileActions.clearRecentFiles(); }}
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
