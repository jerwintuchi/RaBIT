import { useState } from 'react';
import { Dropdown } from '../../primitives/Dropdown/Dropdown';
import styles from '../DevHarness.module.css';

const blendModes = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
];

export function DropdownSection(): JSX.Element {
  const [mode, setMode] = useState('normal');

  return (
    <div className={styles.section}>
      <h2>Dropdown</h2>
      <div className={styles.col} style={{ maxWidth: 200 }}>
        <p className={styles.label}>Default</p>
        <Dropdown value={mode} options={blendModes} onChange={setMode} />
        <p className={styles.label}>Disabled</p>
        <Dropdown value="normal" options={blendModes} onChange={() => {}} disabled />
        <p className={styles.label}>No selection (placeholder)</p>
        <Dropdown value="" options={blendModes} onChange={() => {}} placeholder="Choose blend mode…" />
      </div>
    </div>
  );
}
