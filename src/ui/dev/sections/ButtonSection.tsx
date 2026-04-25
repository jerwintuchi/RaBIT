import { Button } from '../../primitives/Button/Button';
import styles from '../DevHarness.module.css';

export function ButtonSection(): JSX.Element {
  return (
    <div className={styles.section}>
      <h2>Button</h2>
      <p className={styles.label}>Variants</p>
      <div className={styles.row}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <p className={styles.label}>Sizes</p>
      <div className={styles.row}>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="icon" aria-label="icon button">
          ✕
        </Button>
      </div>
      <p className={styles.label}>States</p>
      <div className={styles.row}>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="secondary" kbd="Ctrl+S">
          With Shortcut
        </Button>
        <Button variant="ghost" disabled>
          Ghost Disabled
        </Button>
      </div>
    </div>
  );
}
