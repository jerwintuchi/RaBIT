import { useToolStore } from '../../state/useToolStore';
import type { ToolId } from '../../state/useToolStore';
import {
  LuPencil,
  LuEraser,
  LuMinus,
  LuSquare,
  LuCircle,
  LuPaintBucket,
  LuMove,
  LuSquareDashed,
  LuPipette,
  LuHand,
  LuZoomIn,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { Tooltip } from '../primitives';
import styles from './ToolBar.module.css';

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  description: string;
  Icon: IconType;
}

const TOOLS: ToolDef[] = [
  {
    id: 'pencil',
    label: 'Pencil',
    shortcut: 'B',
    description: 'Draw pixels freehand',
    Icon: LuPencil,
  },
  {
    id: 'eraser',
    label: 'Eraser',
    shortcut: 'E',
    description: 'Erase pixels to transparent',
    Icon: LuEraser,
  },
  {
    id: 'line',
    label: 'Line',
    shortcut: 'L',
    description: 'Draw a straight pixel line',
    Icon: LuMinus,
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    shortcut: 'R',
    description: 'Draw a rectangle outline · Shift = square',
    Icon: LuSquare,
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    shortcut: 'O',
    description: 'Draw an ellipse outline · Shift = circle',
    Icon: LuCircle,
  },
  {
    id: 'fill',
    label: 'Fill',
    shortcut: 'G',
    description: 'Flood-fill contiguous area with primary color',
    Icon: LuPaintBucket,
  },
  {
    id: 'move',
    label: 'Move',
    shortcut: 'V',
    description: 'Move all layer pixels by drag offset',
    Icon: LuMove,
  },
  {
    id: 'marquee',
    label: 'Marquee',
    shortcut: 'M',
    description: 'Rectangular selection · Shift = square',
    Icon: LuSquareDashed,
  },
  {
    id: 'eyedropper',
    label: 'Eyedropper',
    shortcut: 'I',
    description: 'Sample color from canvas',
    Icon: LuPipette,
  },
  {
    id: 'hand',
    label: 'Hand',
    shortcut: 'H',
    description: 'Pan the canvas',
    Icon: LuHand,
  },
  {
    id: 'zoom',
    label: 'Zoom',
    shortcut: 'Z',
    description: 'Click to zoom in · Alt+click to zoom out',
    Icon: LuZoomIn,
  },
];

export function ToolBar(): JSX.Element {
  const activeTool = useToolStore((s) => s.activeTool);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Tools">
      {TOOLS.map(({ id, label, shortcut, description, Icon }) => {
        const isActive = activeTool === id;
        return (
          <Tooltip
            key={id}
            content={label}
            shortcut={shortcut}
            description={description}
            placement="right"
          >
            <button
              type="button"
              className={`${styles.toolButton} ${isActive ? styles.active : ''}`}
              aria-label={label}
              aria-pressed={isActive}
              onClick={(e) => {
                useToolStore.getState().setActiveTool(id);
                e.currentTarget.blur();
              }}
            >
              <Icon size={18} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
