import { useUIStore } from '../../state/useUIStore';
import { fileActions } from '../../state/action-composers';
import styles from './CrashRecoveryDialog.module.css';

function formatSavedAt(savedAt: number): string {
  try {
    return new Date(savedAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(savedAt);
  }
}

export function CrashRecoveryDialog() {
  const { open, savedAt, projectName } = useUIStore((s) => s.crashRecoveryDialog);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="alertdialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.icon}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2L16.5 15H1.5L9 2Z"
                stroke="var(--color-warning)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M9 7V10" stroke="var(--color-warning)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="13" r="0.75" fill="var(--color-warning)" />
            </svg>
          </div>
          <div className={styles.headingGroup}>
            <p className={styles.title}>Unsaved work recovered</p>
            <p className={styles.subtitle}>RaBIT did not exit cleanly last session.</p>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Project</span>
            <span className={styles.infoValue}>{projectName ?? 'Unknown'}</span>
            {savedAt !== null && (
              <span className={styles.infoSub}>Auto-saved {formatSavedAt(savedAt)}</span>
            )}
          </div>
          <p className={styles.description}>
            Restore to continue from the auto-saved state. You will need to Save As to keep it.
            Discard will permanently delete the recovery file.
          </p>
        </div>

        <div className={styles.footer}>
          <button
            className={`${styles.btn} ${styles.btnDiscard}`}
            onClick={() => void fileActions.discardRecovery()}
          >
            Discard
          </button>
          <button
            className={`${styles.btn} ${styles.btnRestore}`}
            onClick={() => void fileActions.restoreRecovery()}
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
