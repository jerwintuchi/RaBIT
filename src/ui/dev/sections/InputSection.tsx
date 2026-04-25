import { useState } from 'react';
import { Input } from '../../primitives/Input/Input';
import { NumberInput } from '../../primitives/Input/NumberInput';
import styles from '../DevHarness.module.css';

export function InputSection(): JSX.Element {
  const [text, setText] = useState('Hello');
  const [num, setNum] = useState(42);

  return (
    <div className={styles.section}>
      <h2>Input</h2>
      <div className={styles.col}>
        <p className={styles.label}>Text input</p>
        <div className={styles.swatch}>
          <Input value={text} onChange={setText} placeholder="Type here…" />
        </div>
        <div className={styles.swatch}>
          <Input value="" onChange={() => {}} placeholder="Placeholder" />
        </div>
        <div className={styles.swatch}>
          <Input value="Invalid value" onChange={() => {}} invalid />
        </div>
        <div className={styles.swatch}>
          <Input value="Disabled" onChange={() => {}} disabled />
        </div>
      </div>
      <div className={styles.col} style={{ marginTop: 16 }}>
        <p className={styles.label}>NumberInput (drag label to scrub)</p>
        <NumberInput value={num} onChange={setNum} label="Size" unit="px" min={1} max={100} />
        <NumberInput value={50} onChange={() => {}} label="Opacity" unit="%" min={0} max={100} disabled />
      </div>
    </div>
  );
}
