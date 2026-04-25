import { useState } from 'react';
import { ColorWells } from './ColorWells';
import { HsvPicker } from './HsvPicker';
import { RgbPicker } from './RgbPicker';
import { HexPicker } from './HexPicker';
import styles from './ColorPickerPanel.module.css';

type Mode = 'hsv' | 'rgb' | 'hex';

const MODES: { value: Mode; label: string }[] = [
  { value: 'hsv', label: 'HSV' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hex', label: 'Hex' },
];

export function ColorPickerPanel(): JSX.Element {
  const [mode, setMode] = useState<Mode>('hsv');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Color</span>
      </div>

      <ColorWells />

      <div className={styles.tabs} role="tablist" aria-label="Color picker mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            className={`${styles.tab} ${mode === m.value ? styles.tabActive : ''}`}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {mode === 'hsv' && <HsvPicker />}
        {mode === 'rgb' && <RgbPicker />}
        {mode === 'hex' && <HexPicker />}
      </div>
    </div>
  );
}
