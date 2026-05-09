import { useUIStore } from '../../state/useUIStore';
import { fileActions, resolvePendingDiscard } from '../../state/action-composers';
import styles from './UnsavedChangesDialog.module.css';

const INTENT_LABELS: Record<string, string> = {
  new: 'Creating a new project will discard your unsaved changes.',
  open: 'Opening a file will discard your unsaved changes.',
  close: 'Closing RaBIT will discard your unsaved changes.',
};

export function UnsavedChangesDialog() {
  const { open, intent } = useUIStore((s) => s.unsavedChangesDialog);
  const hideDialog = () => useUIStore.getState().hideUnsavedChangesDialog();

  if (!open) return null;

  const message = INTENT_LABELS[intent ?? ''] ?? 'Continuing will discard your unsaved changes.';

  async function handleSave() {
    hideDialog();
    const saved = await fileActions.saveProject();
    resolvePendingDiscard(saved);
  }

  function handleDiscard() {
    hideDialog();
    resolvePendingDiscard(true);
  }

  function handleCancel() {
    hideDialog();
    resolvePendingDiscard(false);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Unsaved Changes</h2>
          <p className={styles.message}>
            {message} Do you want to save before continuing?
          </p>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={handleCancel}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.btnDiscard}`} onClick={handleDiscard}>
            Discard
          </button>
          <button className={`${styles.btn} ${styles.btnSave}`} onClick={() => { void handleSave(); }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
