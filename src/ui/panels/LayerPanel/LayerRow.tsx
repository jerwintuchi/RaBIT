import { useState, useRef, useEffect, useCallback } from 'react';
import type { Layer } from '../../../state/dataModelTypes';
import { layerActions } from '../../../state/action-composers';
import { IconEye, IconEyeOff, IconLock } from '../../../assets/icons';
import styles from './LayerRow.module.css';

interface LayerRowProps {
  layer: Layer;
  active: boolean;
  displayIdx: number;
  draggingDisplayIdx: number | null;
  dropDisplayIdx: number | null;
  dropOnTopHalf: boolean;
  onSelect: () => void;
  onDragStart: (displayIdx: number) => void;
  onDragOver: (e: React.DragEvent<HTMLElement>, displayIdx: number) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function LayerRow({
  layer,
  active,
  displayIdx,
  draggingDisplayIdx,
  dropDisplayIdx,
  dropOnTopHalf,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: LayerRowProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const isDraggingThis = draggingDisplayIdx === displayIdx;
  const showTopIndicator = dropDisplayIdx === displayIdx && dropOnTopHalf;
  const showBottomIndicator = dropDisplayIdx === displayIdx && !dropOnTopHalf;

  return (
    <div
      className={[
        styles.row,
        active ? styles.active : '',
        isDraggingThis ? styles.dragging : '',
        showTopIndicator ? styles.dropTop : '',
        showBottomIndicator ? styles.dropBottom : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="option"
      aria-selected={active}
      draggable={!editing}
      onClick={onSelect}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        // Required by Firefox so the drag actually starts
        e.dataTransfer.setData('text/plain', layer.id);
        onDragStart(displayIdx);
      }}
      onDragOver={(e) => onDragOver(e, displayIdx)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
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
    </div>
  );
}
