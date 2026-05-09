import { useState } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { useUIStore } from '../../state/useUIStore';
import { canvasActions } from '../../state/action-composers';
type ResizeMode = 'crop' | 'scale';
import styles from './ResizeCanvasDialog.module.css';

const MAX_DIM = 640;

interface Preset { label: string; w: number; h: number; hint: string; }
const PRESETS: Preset[] = [
  { label: '16×16',   w: 16,  h: 16,  hint: 'Icons / tiny sprites' },
  { label: '32×32',   w: 32,  h: 32,  hint: 'Characters / items' },
  { label: '64×64',   w: 64,  h: 64,  hint: 'Detailed sprites' },
  { label: '128×128', w: 128, h: 128, hint: 'Large scenes' },
  { label: '320×180', w: 320, h: 180, hint: 'HD game background' },
  { label: '640×360', w: 640, h: 360, hint: 'Full widescreen scene' },
];

export function ResizeCanvasDialog() {
  const open = useUIStore((s) => s.resizeCanvasDialog.open);
  const hideDialog = () => useUIStore.getState().hideResizeCanvasDialog();
  const { width: currentW, height: currentH } = useProjectStore((s) => s.canvas);

  const [width, setWidth]   = useState(currentW);
  const [height, setHeight] = useState(currentH);
  const [mode, setMode]     = useState<ResizeMode>('crop');

  // Sync inputs when dialog opens with updated canvas size
  // (uses key reset pattern — parent remounts on open)

  if (!open) return null;

  const widthValid  = Number.isInteger(width)  && width  >= 1 && width  <= MAX_DIM;
  const heightValid = Number.isInteger(height) && height >= 1 && height <= MAX_DIM;
  const unchanged   = width === currentW && height === currentH;
  const canApply    = widthValid && heightValid && !unchanged;

  const activePreset = PRESETS.find((p) => p.w === width && p.h === height);

  function applyPreset(p: Preset) {
    setWidth(p.w);
    setHeight(p.h);
  }

  function handleApply() {
    if (!canApply) return;
    canvasActions.resizeCanvas(width, height, mode);
    hideDialog();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && canApply) handleApply();
    if (e.key === 'Escape') hideDialog();
  }

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown}>
      <div className={styles.card}>

        <div className={styles.header}>
          <h2 className={styles.title}>Resize Canvas</h2>
          <p className={styles.subtitle}>
            Current size: {currentW}×{currentH} px
          </p>
        </div>

        <div className={styles.fields}>

          {/* Mode */}
          <div className={styles.field}>
            <span className={styles.label}>Mode</span>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'crop' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('crop')}
              >
                Crop / Expand
                <span className={styles.modeBtnSub}>Keeps pixel positions</span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'scale' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('scale')}
              >
                Scale
                <span className={styles.modeBtnSub}>Nearest-neighbour</span>
              </button>
            </div>
          </div>

          {/* Scale warning */}
          {mode === 'scale' && (
            <div className={styles.warning}>
              <span className={styles.warningIcon}>⚠</span>
              <span>
                Scale resamples every pixel across all layers and frames.
                Recoverable only via undo — not reversible after the session.
              </span>
            </div>
          )}

          {/* Presets */}
          <div className={styles.field}>
            <span className={styles.label}>Preset Sizes</span>
            <div className={styles.presetGrid}>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`${styles.presetBtn} ${activePreset === p ? styles.presetActive : ''}`}
                  onClick={() => applyPreset(p)}
                  title={p.hint}
                >
                  {p.label}
                  <span className={styles.presetHint}>{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div className={styles.field}>
            <span className={styles.label}>Custom</span>
            <div className={styles.sizeRow}>
              <input
                className={`${styles.input} ${widthValid ? '' : styles.invalid}`}
                type="number"
                min={1}
                max={MAX_DIM}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value, 10))}
                autoFocus
              />
              <span className={styles.sizeSep}>×</span>
              <input
                className={`${styles.input} ${heightValid ? '' : styles.invalid}`}
                type="number"
                min={1}
                max={MAX_DIM}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value, 10))}
              />
              <span className={styles.sizePx}>px</span>
            </div>
            <p className={styles.hint}>Max {MAX_DIM} px per side</p>
          </div>

        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={hideDialog}>Cancel</button>
          <button className={styles.btnApply} onClick={handleApply} disabled={!canApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
