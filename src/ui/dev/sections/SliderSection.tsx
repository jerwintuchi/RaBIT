import { useState } from 'react';
import { Slider } from '../../primitives/Slider/Slider';
import styles from '../DevHarness.module.css';

export function SliderSection(): JSX.Element {
  const [opacity, setOpacity] = useState(75);
  const [size, setSize] = useState(10);

  return (
    <div className={styles.section}>
      <h2>Slider</h2>
      <div className={styles.col} style={{ maxWidth: 300 }}>
        <Slider value={opacity} onChange={setOpacity} label="Opacity" />
        <Slider value={size} onChange={setSize} label="Size" min={1} max={100} />
        <Slider value={40} onChange={() => {}} label="Disabled" disabled />
      </div>
    </div>
  );
}
