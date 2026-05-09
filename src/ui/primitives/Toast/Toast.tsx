import { useEffect } from 'react';
import { useUIStore } from '../../../state/useUIStore';
import type { Toast } from '../../../state/useUIStore';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 4000;

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => useUIStore.getState().removeToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id]);

  return (
    <div className={`${styles.toast} ${styles[toast.variant]}`} role="alert">
      <span className={styles.message}>{toast.message}</span>
      <button
        className={styles.close}
        onClick={() => useUIStore.getState().removeToast(toast.id)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
