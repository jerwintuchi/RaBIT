import { useState, useEffect } from 'react';
import { ProgressBar } from '../../primitives/ProgressBar/ProgressBar';
import styles from '../DevHarness.module.css';

export function ProgressBarSection(): JSX.Element {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setProgress((v) => (v >= 100 ? 0 : v + 2)), 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.section}>
      <h2>ProgressBar</h2>
      <div className={styles.col} style={{ maxWidth: 300 }}>
        <ProgressBar value={progress} label="Exporting spritesheet…" />
        <ProgressBar value={74} label="Static value" />
        <ProgressBar value={100} label="Complete" />
        <ProgressBar value={33} showPercentage={false} label="No percentage" />
      </div>
    </div>
  );
}
