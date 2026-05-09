import styles from './CanvasEmptyState.module.css';

const GRID_SIZE = 8; // cells per side in the pixel-grid illustration

function PixelGridSvg() {
  const cell = 128 / GRID_SIZE;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      // Highlight the four centre cells a bit more
      const centre = (r === 3 || r === 4) && (c === 3 || c === 4);
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={c * cell + 0.5}
          y={r * cell + 0.5}
          width={cell - 1}
          height={cell - 1}
          rx={1}
          fill={centre ? 'var(--accent-primary, #4f8ef7)' : 'var(--text-muted, #666)'}
          opacity={centre ? 0.35 : 1}
        />,
      );
    }
  }
  return (
    <svg className={styles.grid} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      {cells}
    </svg>
  );
}

export function CanvasEmptyState() {
  return (
    <div className={styles.root}>
      <div className={styles.illustration}>
        <PixelGridSvg />
        <div className={styles.centerGlow}>
          <div className={styles.glowDot} />
        </div>
      </div>

      <div className={styles.text}>
        <p className={styles.heading}>No canvas open</p>
        <p className={styles.body}>
          Create a new project or open an existing&nbsp;.rabit file to start drawing.
        </p>
      </div>

      <div className={styles.shortcuts}>
        <div className={styles.shortcut}>
          <kbd className={styles.kbd}>Ctrl N</kbd>
          <span>New</span>
        </div>
        <div className={styles.shortcut}>
          <kbd className={styles.kbd}>Ctrl O</kbd>
          <span>Open</span>
        </div>
      </div>
    </div>
  );
}
