import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export function ProgressBar({ value, label, showPercentage = true, animated = true }: ProgressBarProps): JSX.Element {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={styles.wrapper}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {(label ?? showPercentage) && (
        <div className={styles.labelRow}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercentage && <span className={styles.percentage}>{clamped}%</span>}
        </div>
      )}
      <div className={styles.track}>
        <div
          className={[styles.fill, animated ? styles.animated : ''].filter(Boolean).join(' ')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
