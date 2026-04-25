import { Tooltip } from '../../primitives/Tooltip/Tooltip';
import { Button } from '../../primitives/Button/Button';
import styles from '../DevHarness.module.css';

export function TooltipSection(): JSX.Element {
  return (
    <div className={styles.section}>
      <h2>Tooltip</h2>
      <p className={styles.label}>Hover the buttons to see tooltips (500ms delay)</p>
      <div className={styles.row}>
        <Tooltip content="Pencil tool" shortcut="B">
          <Button variant="ghost">Pencil</Button>
        </Tooltip>
        <Tooltip content="Undo last action" shortcut="Ctrl+Z" placement="top">
          <Button variant="secondary">Undo (top)</Button>
        </Tooltip>
        <Tooltip content="This tooltip appears on the right" placement="right">
          <Button variant="secondary">Right placement</Button>
        </Tooltip>
      </div>
    </div>
  );
}
