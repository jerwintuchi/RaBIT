import { useState } from 'react';
import { Checkbox } from '../../primitives/Checkbox/Checkbox';
import { Toggle } from '../../primitives/Toggle/Toggle';
import styles from '../DevHarness.module.css';

export function CheckboxSection(): JSX.Element {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [t, setT] = useState(false);

  return (
    <div className={styles.section}>
      <h2>Checkbox &amp; Toggle</h2>
      <div className={styles.col}>
        <p className={styles.label}>Checkbox</p>
        <Checkbox checked={a} onChange={setA} label="Unchecked" />
        <Checkbox checked={b} onChange={setB} label="Checked" />
        <Checkbox checked="indeterminate" onChange={() => {}} label="Indeterminate" />
        <Checkbox checked={false} onChange={() => {}} label="Disabled" disabled />
      </div>
      <div className={styles.col} style={{ marginTop: 16 }}>
        <p className={styles.label}>Toggle</p>
        <Toggle checked={t} onChange={setT} label="Show grid" />
        <Toggle checked={true} onChange={() => {}} label="Onion skin" />
        <Toggle checked={false} onChange={() => {}} label="Disabled" disabled />
      </div>
    </div>
  );
}
