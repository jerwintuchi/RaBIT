import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../../state/useProjectStore';
import styles from './SaveBadge.module.css';

const VISIBLE_MS = 1500;
const LEAVE_MS = 280;

export function SaveBadge() {
  const savedAt = useProjectStore((s) => s.meta.savedAt);
  // Initialize to the current value so a pre-existing savedAt (from project load)
  // does not trigger the badge — only changes after mount should.
  const prevSavedAt = useRef<number | null>(savedAt);

  const [phase, setPhase] = useState<'hidden' | 'visible' | 'leaving'>('hidden');

  useEffect(() => {
    if (savedAt === null || savedAt === prevSavedAt.current) return;
    prevSavedAt.current = savedAt;

    setPhase('visible');

    const hideTimer = setTimeout(() => setPhase('leaving'), VISIBLE_MS);
    const removeTimer = setTimeout(() => setPhase('hidden'), VISIBLE_MS + LEAVE_MS);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [savedAt]);

  if (phase === 'hidden') return null;

  return (
    <div className={`${styles.badge}${phase === 'leaving' ? ` ${styles.leaving}` : ''}`}>
      <span className={styles.check}>
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Saved
    </div>
  );
}
