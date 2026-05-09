import { useEffect, useState } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import styles from './ProjectStatusBar.module.css';

function formatSavedAt(savedAt: number | null): string {
  if (savedAt === null) return 'Never saved';
  const diff = Math.floor((Date.now() - savedAt) / 1000);
  if (diff < 10) return 'Saved just now';
  if (diff < 60) return `Saved ${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `Saved ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `Saved ${hrs}h ago`;
}

function formatPath(filePath: string | null): string {
  if (!filePath) return 'Unsaved';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : filePath;
}

export function ProjectStatusBar() {
  const name = useProjectStore((s) => s.meta.name);
  const filePath = useProjectStore((s) => s.meta.filePath);
  const dirty = useProjectStore((s) => s.meta.dirty);
  const savedAt = useProjectStore((s) => s.meta.savedAt);

  const [savedLabel, setSavedLabel] = useState(() => formatSavedAt(savedAt));

  useEffect(() => {
    setSavedLabel(formatSavedAt(savedAt));
    const id = setInterval(() => setSavedLabel(formatSavedAt(savedAt)), 30_000);
    return () => clearInterval(id);
  }, [savedAt]);

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <span className={`${styles.dirtyDot}${dirty ? ` ${styles.visible}` : ''}`} />
        <span className={styles.name}>{name}</span>
        <span className={styles.sep}>·</span>
        <span className={styles.path}>{formatPath(filePath)}</span>
        <span className={styles.sep}>·</span>
        <span className={styles.savedAt}>{savedLabel}</span>
      </div>
    </div>
  );
}
