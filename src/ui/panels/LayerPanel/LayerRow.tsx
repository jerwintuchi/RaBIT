import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LuChevronDown, LuChevronRight, LuFolder } from 'react-icons/lu';
import type { Layer } from '../../../state/dataModelTypes';
import { layerActions } from '../../../state/action-composers';
import { IconEye, IconEyeOff, IconLock } from '../../../assets/icons';
import { LayerThumbnail } from './LayerThumbnail';
import { ContextMenu } from '../../primitives';
import type { ContextMenuItem } from '../../primitives';
import styles from './LayerRow.module.css';

interface LayerRowProps {
  layer: Layer;
  active: boolean;
  selected: boolean;
  displayIdx: number;
  draggingDisplayIdx: number | null;
  dropDisplayIdx: number | null;
  dropOnTopHalf: boolean;
  dropGroupId: string | null;
  onSelect: (e: React.MouseEvent) => void;
}

export function LayerRow({
  layer,
  active,
  selected,
  displayIdx,
  draggingDisplayIdx,
  dropDisplayIdx,
  dropOnTopHalf,
  dropGroupId,
  onSelect,
}: LayerRowProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(layer.name);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGroup = layer.type === 'group';
  const isChild = layer.parentGroupId !== null;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startRename = useCallback(() => {
    setDraftName(layer.name);
    setEditing(true);
  }, [layer.name]);

  const commitRename = useCallback(() => {
    setEditing(false);
    layerActions.renameLayer(layer.id, draftName);
  }, [layer.id, draftName]);

  const cancelRename = useCallback(() => {
    setEditing(false);
    setDraftName(layer.name);
  }, [layer.name]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  };

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const ctxItems: ContextMenuItem[] = useMemo(() => {
    const base: ContextMenuItem[] = [
      {
        type: 'item',
        label: 'Rename',
        onClick: () => { setCtxMenu(null); startRename(); },
      },
    ];

    if (isGroup) {
      base.push({
        type: 'item',
        label: 'Add layer to group',
        onClick: () => { setCtxMenu(null); layerActions.addLayer(undefined, layer.id); },
      });
    } else {
      base.push(
        {
          type: 'item',
          label: 'Duplicate layer',
          onClick: () => { setCtxMenu(null); layerActions.duplicateLayer(layer.id); },
        },
        {
          type: 'item',
          label: 'Merge down',
          onClick: () => { setCtxMenu(null); layerActions.mergeDown(layer.id); },
        },
      );
    }

    if (isChild) {
      base.push({
        type: 'item',
        label: 'Remove from group',
        onClick: () => { setCtxMenu(null); layerActions.moveLayerOutOfGroup(layer.id); },
      });
    }

    base.push({ type: 'separator' });
    base.push({
      type: 'item',
      label: isGroup ? 'Delete group' : 'Delete layer',
      danger: true,
      onClick: () => { setCtxMenu(null); layerActions.removeLayer(layer.id); },
    });

    return base;
  }, [startRename, layer.id, isGroup, isChild]);

  const isDraggingThis = draggingDisplayIdx === displayIdx;
  const showTopIndicator = dropDisplayIdx === displayIdx && dropOnTopHalf;
  const showBottomIndicator = dropDisplayIdx === displayIdx && !dropOnTopHalf;
  // Group highlight: shown on the group row that will receive the dragged layer
  const isGroupDropTarget = isGroup && layer.id === dropGroupId;
  // Drop line indent: shown when the insertion point is inside any group
  const dropLineIndented = dropGroupId !== null && (showTopIndicator || showBottomIndicator);

  return (
    <div
      className={[
        styles.row,
        active ? styles.active : '',
        selected && !active ? styles.selected : '',
        isDraggingThis ? styles.dragging : '',
        showTopIndicator ? styles.dropTop : '',
        showBottomIndicator ? styles.dropBottom : '',
        isChild ? styles.childLayer : '',
        isGroupDropTarget ? styles.groupDropTarget : '',
        dropLineIndented ? styles.dropLineIndented : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="option"
      aria-selected={active}
      data-display-idx={displayIdx}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {isGroup ? (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={layer.collapsed ? 'Expand group' : 'Collapse group'}
          onClick={(e) => {
            e.stopPropagation();
            layerActions.toggleGroupCollapsed(layer.id);
          }}
        >
          {layer.collapsed ? <LuChevronRight size={14} /> : <LuChevronDown size={14} />}
        </button>
      ) : (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
          aria-pressed={!layer.visible}
          onClick={(e) => {
            e.stopPropagation();
            layerActions.setLayerVisibility(layer.id, !layer.visible);
          }}
        >
          {layer.visible ? <IconEye /> : <IconEyeOff />}
        </button>
      )}
      <button
        type="button"
        className={`${styles.iconButton} ${layer.locked ? styles.locked : ''}`}
        aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
        aria-pressed={layer.locked}
        onClick={(e) => {
          e.stopPropagation();
          layerActions.setLayerLocked(layer.id, !layer.locked);
        }}
      >
        <IconLock />
      </button>
      {isGroup ? (
        <span className={styles.groupIcon}>
          <LuFolder size={14} />
        </span>
      ) : (
        <LayerThumbnail layerId={layer.id} />
      )}
      {editing ? (
        <input
          ref={inputRef}
          className={styles.nameInput}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          maxLength={64}
        />
      ) : (
        <span
          className={styles.name}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startRename();
          }}
          title={layer.name}
        >
          {layer.name}
        </span>
      )}
      {ctxMenu && (
        <ContextMenu
          items={ctxItems}
          anchor={ctxMenu}
          onClose={closeCtxMenu}
        />
      )}
    </div>
  );
}
