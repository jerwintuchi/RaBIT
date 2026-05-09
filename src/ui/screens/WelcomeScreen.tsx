import { useUIStore } from '../../state/useUIStore';
import { fileActions } from '../../state/action-composers';
import { NewProjectDialog } from '../dialogs/NewProjectDialog';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const recentFiles = useUIStore((s) => s.recentFiles);
  const showNewProjectDialog = useUIStore((s) => s.showNewProjectDialog);

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>

        {/* ── Left sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.logoText}>RaBIT</div>
            <div className={styles.version}>v0.1.0 · Raster + Bit creation system</div>
          </div>

          <div className={styles.sidebarDivider} />

          <div className={styles.sidebarActions}>
            <div className={styles.actionSectionLabel}>Start</div>
            <button className={styles.btnNew} onClick={showNewProjectDialog}>
              <span className={styles.btnIcon}>✦</span>
              New Project…
            </button>
            <button className={styles.btnOpen} onClick={() => fileActions.openProject()}>
              <span className={styles.btnIcon}>⌂</span>
              Open File…
            </button>
          </div>

          <div className={styles.sidebarSpacer} />

          <button
            className={styles.btnSkip}
            onClick={() => fileActions.newProject('Untitled', 32, 32)}
          >
            Skip → blank 32×32 canvas
          </button>
        </aside>

        {/* ── Recent files ── */}
        <main className={styles.main}>
          <div className={styles.sectionLabel}>Recent Projects</div>
          {recentFiles.length === 0 ? (
            <p className={styles.emptyRecent}>No recent projects yet.</p>
          ) : (
            <ul className={styles.recentList}>
              {recentFiles.map((f) => (
                <li
                  key={f.path}
                  className={`${styles.recentItem} ${f.missing ? styles.missing : ''}`}
                  onClick={() => { if (!f.missing) fileActions.openProjectAt(f.path); }}
                  title={f.path}
                >
                  <div className={styles.recentItemMeta}>
                    <div className={styles.recentItemName}>{f.name}</div>
                    <div className={styles.recentItemPath}>{f.path}</div>
                  </div>
                  {f.missing && (
                    <button
                      className={styles.removeBtn}
                      onClick={(e) => { e.stopPropagation(); fileActions.removeRecentFile(f.path); }}
                      title="Remove from list"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>

        {/* ── Footer hint ── */}
        <footer className={styles.mainFooter}>
          <span className={styles.footerHint}>Ctrl+N · New &nbsp;·&nbsp; Ctrl+O · Open</span>
        </footer>
      </div>

      <NewProjectDialog />
    </div>
  );
}
