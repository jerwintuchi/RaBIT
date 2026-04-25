import { Panel } from '../../primitives/Panel/Panel';
import { Button } from '../../primitives/Button/Button';
import styles from '../DevHarness.module.css';

export function PanelSection(): JSX.Element {
  return (
    <div className={styles.section} style={{ maxWidth: 300 }}>
      <h2>Panel</h2>
      <Panel
        title="Layers"
        actions={
          <Button variant="ghost" size="icon" aria-label="Add layer">
            +
          </Button>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Layer 1</p>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Layer 2</p>
      </Panel>
      <div style={{ height: 8 }} />
      <Panel title="Collapsed by default" defaultExpanded={false}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Hidden content</p>
      </Panel>
    </div>
  );
}
