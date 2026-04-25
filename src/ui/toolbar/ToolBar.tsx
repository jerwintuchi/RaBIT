import { useToolStore } from '../../state/useToolStore';
import type { ToolId } from '../../state/useToolStore';
import { IconPencil } from '../../assets/icons';
import { Tooltip } from '../primitives';
import styles from './ToolBar.module.css';

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  Icon: typeof IconPencil;
}

const TOOLS: ToolDef[] = [
  { id: 'pencil', label: 'Pencil', shortcut: 'B', Icon: IconPencil },
];

export function ToolBar(): JSX.Element {
  const activeTool = useToolStore((s) => s.activeTool);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Tools">
      {TOOLS.map(({ id, label, shortcut, Icon }) => {
        const isActive = activeTool === id;
        return (
          <Tooltip key={id} content={`${label} (${shortcut})`} placement="right">
            <button
              type="button"
              className={`${styles.toolButton} ${isActive ? styles.active : ''}`}
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => useToolStore.getState().setActiveTool(id)}
            >
              <Icon />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
