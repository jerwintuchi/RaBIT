import { useState } from 'react';
import { ModalDialog } from '../../primitives/ModalDialog/ModalDialog';
import { Button } from '../../primitives/Button/Button';
import styles from '../DevHarness.module.css';

export function ModalDialogSection(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [lgOpen, setLgOpen] = useState(false);

  return (
    <div className={styles.section}>
      <h2>ModalDialog</h2>
      <div className={styles.row}>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open small dialog
        </Button>
        <Button variant="secondary" onClick={() => setLgOpen(true)}>
          Open large dialog
        </Button>
      </div>

      <ModalDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Export settings"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Export
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Configure your export settings here. Press Escape or click outside to close.
        </p>
      </ModalDialog>

      <ModalDialog
        isOpen={lgOpen}
        onClose={() => setLgOpen(false)}
        title="Keyboard shortcuts"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setLgOpen(false)}>
            Close
          </Button>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Large dialog variant — max-width 640px. Used for dense content like keyboard shortcuts or preferences.
        </p>
      </ModalDialog>
    </div>
  );
}
