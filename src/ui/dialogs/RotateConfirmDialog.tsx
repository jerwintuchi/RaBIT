import { useUIStore } from '../../state/useUIStore';
import { resolveRotateConfirm } from '../../state/action-composers/canvasActions';
import styles from './UnsavedChangesDialog.module.css';

export function RotateConfirmDialog() {
  const open = useUIStore((s) => s.rotateConfirmDialog.open);

  if (!open) return null;

  function handleConfirm() {
    useUIStore.getState().hideRotateConfirmDialog();
    resolveRotateConfirm(true);
  }

  function handleCancel() {
    useUIStore.getState().hideRotateConfirmDialog();
    resolveRotateConfirm(false);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Rotate Canvas</h2>
          <p className={styles.message}>
            Rotating a non-square canvas will change its dimensions. This cannot be undone past the current session. Continue?
          </p>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={handleCancel}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.btnSave}`} onClick={handleConfirm}>
            Rotate
          </button>
        </div>
      </div>
    </div>
  );
}
