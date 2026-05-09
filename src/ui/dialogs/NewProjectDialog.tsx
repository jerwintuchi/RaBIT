import { useState } from 'react';
import { useUIStore } from '../../state/useUIStore';
import { fileActions } from '../../state/action-composers';
import styles from './NewProjectDialog.module.css';

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

export function NewProjectDialog() {
  const open = useUIStore((s) => s.newProjectDialog.open);
  const hideDialog = () => useUIStore.getState().hideNewProjectDialog();

  const [name, setName]     = useState('Untitled');
  const [width, setWidth]   = useState(32);
  const [height, setHeight] = useState(32);

  if (!open) return null;

  const widthValid  = Number.isInteger(width)  && width  >= 1 && width  <= MAX_DIM;
  const heightValid = Number.isInteger(height) && height >= 1 && height <= MAX_DIM;
  const nameValid   = name.trim().length > 0;
  const canConfirm  = widthValid && heightValid && nameValid;

  function applyPreset(p: Preset) {
    setWidth(p.w);
    setHeight(p.h);
  }

  function handleConfirm() {
    if (!canConfirm) return;
    void fileActions.newProject(name.trim(), width, height);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && canConfirm) handleConfirm();
    if (e.key === 'Escape') hideDialog();
  }

  const activePreset = PRESETS.find((p) => p.w === width && p.h === height);

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown}>
      <div className={styles.card}>

        <div className={styles.header}>
          <h2 className={styles.title}>New Project</h2>
          <p className={styles.subtitle}>Choose a preset or enter a custom size.</p>
        </div>

        <div className={styles.fields}>
          {/* Name */}
          <div className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Untitled"
            />
          </div>

          {/* Preset grid */}
          <div className={styles.field}>
            <span className={styles.label}>Canvas Size</span>
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

          {/* Custom W × H inputs */}
          <div className={styles.field}>
            <span className={styles.label}>Custom</span>
            <div className={styles.sizeRow}>
              <div className={styles.sizeField}>
                <input
                  className={`${styles.input} ${widthValid ? '' : styles.invalid}`}
                  type="number"
                  min={1}
                  max={MAX_DIM}
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value, 10))}
                  placeholder="W"
                />
              </div>
              <span className={styles.sizeSep}>×</span>
              <div className={styles.sizeField}>
                <input
                  className={`${styles.input} ${heightValid ? '' : styles.invalid}`}
                  type="number"
                  min={1}
                  max={MAX_DIM}
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value, 10))}
                  placeholder="H"
                />
              </div>
              <span className={styles.sizePx}>px</span>
            </div>
            <p className={styles.hint}>Max {MAX_DIM} px per side</p>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={hideDialog}>Cancel</button>
          <button className={styles.btnCreate} onClick={handleConfirm} disabled={!canConfirm}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
