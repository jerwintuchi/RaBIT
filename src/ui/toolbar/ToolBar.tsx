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
  LuWand,
  LuLasso,
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
    shortcut: 'N',
    description: 'Draw a straight pixel line',
    Icon: LuMinus,
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    shortcut: 'R',
    description: 'Draw a rectangle outline - Shift = square',
    Icon: LuSquare,
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    shortcut: 'O',
    description: 'Draw an ellipse outline - Shift = circle',
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
    description: 'Rectangular selection - Shift = square',
    Icon: LuSquareDashed,
  },
  {
    id: 'lasso',
    label: 'Lasso',
    shortcut: 'L',
    description: 'Freehand selection',
    Icon: LuLasso,
  },
  {
    id: 'magic-wand',
    label: 'Magic Wand',
    shortcut: 'W',
    description: 'Select pixels by color similarity',
    Icon: LuWand,
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
    description: 'Click to zoom in - Alt+click to zoom out',
    Icon: LuZoomIn,
  },
];

export function ToolBar(): JSX.Element {
  const activeTool = useToolStore((s) => s.activeTool);
  const mirrorMode = useToolStore((s) => s.mirrorMode);
  const pixelPerfect = useToolStore((s) => s.options.pencil.pixelPerfect);

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

      <div className={styles.separator} />

      <Tooltip content="Pixel-Perfect" shortcut="P" description="Remove L-shaped elbows from diagonal strokes (pencil/eraser)" placement="right">
        <button
          type="button"
          className={`${styles.toolButton} ${pixelPerfect ? styles.active : ''}`}
          aria-label="Pixel Perfect"
          aria-pressed={pixelPerfect}
          onClick={(e) => {
            useToolStore.getState().updateOptions('pencil', { pixelPerfect: !pixelPerfect });
            e.currentTarget.blur();
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.5px' }}>PP</span>
        </button>
      </Tooltip>

      <Tooltip content="Mirror H" shortcut="Y" description="Mirror strokes horizontally" placement="right">
        <button
          type="button"
          className={`${styles.toolButton} ${mirrorMode.h ? styles.active : ''}`}
          aria-label="Mirror Horizontal"
          aria-pressed={mirrorMode.h}
          onClick={(e) => {
            useToolStore.getState().setMirrorMode({ h: !mirrorMode.h });
            e.currentTarget.blur();
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px' }}>MH</span>
        </button>
      </Tooltip>

      <Tooltip content="Mirror V" shortcut="Shift+Y" description="Mirror strokes vertically" placement="right">
        <button
          type="button"
          className={`${styles.toolButton} ${mirrorMode.v ? styles.active : ''}`}
          aria-label="Mirror Vertical"
          aria-pressed={mirrorMode.v}
          onClick={(e) => {
            useToolStore.getState().setMirrorMode({ v: !mirrorMode.v });
            e.currentTarget.blur();
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px' }}>MV</span>
        </button>
      </Tooltip>
    </div>
  );
}
