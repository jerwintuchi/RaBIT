import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToolStore } from '../../state/useToolStore';
import type { ToolId, BrushShape } from '../../state/useToolStore';
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
  { id: 'pencil',    label: 'Pencil',      shortcut: 'B', description: 'Draw pixels freehand',                        Icon: LuPencil    },
  { id: 'eraser',    label: 'Eraser',      shortcut: 'E', description: 'Erase pixels to transparent',                 Icon: LuEraser    },
  { id: 'line',      label: 'Line',        shortcut: 'N', description: 'Draw a straight pixel line',                  Icon: LuMinus     },
  { id: 'rectangle', label: 'Rectangle',   shortcut: 'R', description: 'Draw a rectangle outline - Shift = square',   Icon: LuSquare    },
  { id: 'ellipse',   label: 'Ellipse',     shortcut: 'O', description: 'Draw an ellipse outline - Shift = circle',    Icon: LuCircle    },
  { id: 'fill',      label: 'Fill',        shortcut: 'G', description: 'Flood-fill contiguous area with primary color', Icon: LuPaintBucket },
  { id: 'move',      label: 'Move',        shortcut: 'V', description: 'Move all layer pixels by drag offset',        Icon: LuMove      },
  { id: 'marquee',   label: 'Marquee',     shortcut: 'M', description: 'Rectangular selection - Shift = square',      Icon: LuSquareDashed },
  { id: 'lasso',     label: 'Lasso',       shortcut: 'L', description: 'Freehand selection',                          Icon: LuLasso     },
  { id: 'magic-wand',label: 'Magic Wand',  shortcut: 'W', description: 'Select pixels by color similarity',           Icon: LuWand      },
  { id: 'eyedropper',label: 'Eyedropper',  shortcut: 'I', description: 'Sample color from canvas',                   Icon: LuPipette   },
  { id: 'hand',      label: 'Hand',        shortcut: 'H', description: 'Pan the canvas',                              Icon: LuHand      },
  { id: 'zoom',      label: 'Zoom',        shortcut: 'Z', description: 'Click to zoom in - Alt+click to zoom out',    Icon: LuZoomIn    },
];

const BRUSH_SIZES = [1, 2, 3, 5, 7, 9, 13, 16] as const;

// ── Brush flyout ────────────────────────────────────────────────────────────

interface BrushFlyoutProps {
  label: string;
  shortcut: string;
  size: number;
  shape: BrushShape;
  isPP: boolean; // pixel-perfect active (pencil only)
  onSetSize(s: number): void;
  onSetShape(shape: BrushShape): void;
  children: React.ReactNode;
}

function BrushFlyout({ label, shortcut, size, shape, isPP, onSetSize, onSetShape, children }: BrushFlyoutProps) {
  const [visible, setVisible] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openFlyout = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setFlyoutPos({ top: rect.top, left: rect.right + 8 });
    }
    setVisible(true);
  };

  const schedulHide = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 120);
  };

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const effectiveSize = isPP ? 1 : size;
  const showShape = !isPP;

  return (
    <div ref={wrapperRef} onMouseEnter={openFlyout} onMouseLeave={schedulHide}>
      {children}
      {visible && createPortal(
        <div
          className={styles.brushFlyout}
          style={{ top: flyoutPos.top, left: flyoutPos.left }}
          onMouseEnter={cancelHide}
          onMouseLeave={schedulHide}
        >
          <div className={styles.flyoutHeader}>
            <span className={styles.flyoutToolName}>{label}</span>
            <span className={styles.flyoutShortcut}>{shortcut}</span>
          </div>
          <div className={styles.flyoutDivider} />
          <span className={styles.flyoutLabel}>SIZE</span>
          <div className={styles.flyoutGrid}>
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.flyoutChip} ${effectiveSize === s ? styles.flyoutChipActive : ''}`}
                disabled={(isPP && s !== 1) || (shape === 'round' && s <= 2)}
                aria-pressed={effectiveSize === s}
                onClick={() => { onSetSize(s); }}
              >
                {s}
                <span className={styles.flyoutChipPx}>px</span>
              </button>
            ))}
          </div>
          {showShape && (
            <>
              <span className={styles.flyoutLabel}>SHAPE</span>
              <div className={styles.flyoutShapeRow}>
                <button
                  type="button"
                  className={`${styles.flyoutShapeBtn} ${shape === 'square' ? styles.flyoutChipActive : ''}`}
                  aria-pressed={shape === 'square'}
                  onClick={() => onSetShape('square')}
                  title="Square"
                >
                  ■
                </button>
                <button
                  type="button"
                  className={`${styles.flyoutShapeBtn} ${shape === 'round' ? styles.flyoutChipActive : ''}`}
                  aria-pressed={shape === 'round'}
                  onClick={() => onSetShape('round')}
                  title="Round"
                >
                  ●
                </button>
              </div>
            </>
          )}
          {isPP && (
            <span className={styles.flyoutNote}>PP active → 1px only</span>
          )}
          <span className={styles.flyoutBracketHint}>[  ] to resize</span>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── ToolBar ─────────────────────────────────────────────────────────────────

export function ToolBar(): JSX.Element {
  const activeTool = useToolStore((s) => s.activeTool);
  const mirrorMode = useToolStore((s) => s.mirrorMode);
  const pixelPerfect = useToolStore((s) => s.options.pencil.pixelPerfect);
  const pencilSize  = useToolStore((s) => s.options.pencil.size);
  const pencilShape = useToolStore((s) => s.options.pencil.brushShape);
  const eraserSize  = useToolStore((s) => s.options.eraser.size);
  const eraserShape = useToolStore((s) => s.options.eraser.brushShape);

  function setSize(tool: 'pencil' | 'eraser', s: number) {
    useToolStore.getState().updateOptions(tool, { size: s });
  }
  function setShape(tool: 'pencil' | 'eraser', shape: BrushShape) {
    const cur = useToolStore.getState().options[tool].size;
    const update: { brushShape: BrushShape; size?: number } = { brushShape: shape };
    if (shape === 'round' && cur <= 2) update.size = 3;
    useToolStore.getState().updateOptions(tool, update);
  }

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Tools">
      {TOOLS.map(({ id, label, shortcut, description, Icon }) => {
        const isActive = activeTool === id;

        // Pencil and eraser get a hover flyout — tooltip is suppressed since
        // the flyout header already shows the tool name and shortcut.
        if (id === 'pencil' || id === 'eraser') {
          const isBrush = id === 'pencil';
          return (
            <BrushFlyout key={id}
              label={label}
              shortcut={shortcut}
              size={isBrush ? pencilSize : eraserSize}
              shape={isBrush ? pencilShape : eraserShape}
              isPP={isBrush && pixelPerfect}
              onSetSize={(s) => setSize(id, s)}
              onSetShape={(sh) => setShape(id, sh)}
            >
              <button
                type="button"
                className={`${styles.toolButton} ${isActive ? styles.active : ''}`}
                aria-label={label}
                aria-pressed={isActive}
                onClick={(e) => { useToolStore.getState().setActiveTool(id); e.currentTarget.blur(); }}
              >
                <Icon size={18} />
              </button>
            </BrushFlyout>
          );
        }

        return (
          <Tooltip key={id} content={label} shortcut={shortcut} description={description} placement="right">
            <button
              type="button"
              className={`${styles.toolButton} ${isActive ? styles.active : ''}`}
              aria-label={label}
              aria-pressed={isActive}
              onClick={(e) => { useToolStore.getState().setActiveTool(id); e.currentTarget.blur(); }}
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
          onClick={(e) => { useToolStore.getState().updateOptions('pencil', { pixelPerfect: !pixelPerfect }); e.currentTarget.blur(); }}
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
          onClick={(e) => { useToolStore.getState().setMirrorMode({ h: !mirrorMode.h }); e.currentTarget.blur(); }}
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
          onClick={(e) => { useToolStore.getState().setMirrorMode({ v: !mirrorMode.v }); e.currentTarget.blur(); }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px' }}>MV</span>
        </button>
      </Tooltip>
    </div>
  );
}
