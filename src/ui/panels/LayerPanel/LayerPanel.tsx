import { useMemo, useState } from 'react';
import type { BlendMode } from '../../../state/dataModelTypes';
import { useLayerStore } from '../../../state/useLayerStore';
import { layerActions } from '../../../state/action-composers';
import { Slider, Dropdown, Tooltip } from '../../primitives';
import { IconPlus, IconTrash } from '../../../assets/icons';
import { LayerRow } from './LayerRow';
import styles from './LayerPanel.module.css';

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'add', label: 'Add' },
  { value: 'subtract', label: 'Subtract' },
];

export function LayerPanel(): JSX.Element {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? null,
    [layers, activeLayerId],
  );

  // Display order is reverse of array order — top of UI = top of stack = end of array
  const displayLayers = useMemo(() => [...layers].reverse(), [layers]);

  // Drag-to-reorder state (display indices)
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dropInfo, setDropInfo] = useState<{ idx: number; topHalf: boolean } | null>(null);

  const onRowDragStart = (displayIdx: number) => {
    setDragSrc(displayIdx);
  };

  const onRowDragOver = (e: React.DragEvent<HTMLElement>, displayIdx: number) => {
    if (dragSrc === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const topHalf = e.clientY < rect.top + rect.height / 2;
    setDropInfo((prev) =>
      prev?.idx === displayIdx && prev.topHalf === topHalf ? prev : { idx: displayIdx, topHalf },
    );
  };

  const onDragEnd = () => {
    setDragSrc(null);
    setDropInfo(null);
  };

  const onDrop = () => {
    if (dragSrc === null || dropInfo === null) {
      onDragEnd();
      return;
    }
    // Compute the target display "slot" — where the dragged row will land
    let slot = dropInfo.topHalf ? dropInfo.idx : dropInfo.idx + 1;
    // Account for the source's removal: slots after the source shift up by 1
    if (slot > dragSrc) slot -= 1;
    if (slot !== dragSrc) {
      const fromArr = layers.length - 1 - dragSrc;
      const toArr = layers.length - 1 - slot;
      layerActions.reorderLayer(fromArr, toArr);
    }
    onDragEnd();
  };

  const onDelete = () => {
    if (activeLayerId) layerActions.removeLayer(activeLayerId);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Layers</span>
        <div className={styles.headerActions}>
          <Tooltip content="Add layer" placement="left">
            <button
              type="button"
              className={styles.headerButton}
              aria-label="Add layer"
              onClick={() => layerActions.addLayer()}
            >
              <IconPlus />
            </button>
          </Tooltip>
          <Tooltip content="Delete layer" placement="left">
            <button
              type="button"
              className={styles.headerButton}
              aria-label="Delete layer"
              disabled={!activeLayerId || layers.length <= 1}
              onClick={onDelete}
            >
              <IconTrash />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.list} role="listbox" aria-label="Layers">
        {displayLayers.map((layer, displayIdx) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            active={layer.id === activeLayerId}
            displayIdx={displayIdx}
            draggingDisplayIdx={dragSrc}
            dropDisplayIdx={dropInfo?.idx ?? null}
            dropOnTopHalf={dropInfo?.topHalf ?? false}
            onSelect={() => useLayerStore.getState().setActiveLayer(layer.id)}
            onDragStart={onRowDragStart}
            onDragOver={onRowDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>Blend</span>
          <Dropdown
            value={activeLayer?.blendMode ?? 'normal'}
            options={BLEND_OPTIONS}
            disabled={!activeLayer}
            aria-label="Blend mode"
            onChange={(v) => {
              if (activeLayer) layerActions.setLayerBlendMode(activeLayer.id, v as BlendMode);
            }}
          />
        </div>
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>Opacity</span>
          <Slider
            value={Math.round((activeLayer?.opacity ?? 1) * 100)}
            min={0}
            max={100}
            step={1}
            showValue={false}
            disabled={!activeLayer}
            aria-label="Layer opacity"
            onChange={(v) => {
              if (activeLayer) layerActions.setLayerOpacity(activeLayer.id, v / 100);
            }}
          />
          <span className={styles.footerValue}>
            {Math.round((activeLayer?.opacity ?? 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
