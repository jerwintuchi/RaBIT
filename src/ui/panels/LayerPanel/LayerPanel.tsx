import { useMemo, useState, useCallback } from 'react';
import { LuMerge, LuCopy } from 'react-icons/lu';
import type { BlendMode } from '../../../state/dataModelTypes';
import { useLayerStore } from '../../../state/useLayerStore';
import { layerActions } from '../../../state/action-composers';
import { Dropdown, Tooltip } from '../../primitives';
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

  // Multi-select: set of layer IDs that are highlighted (beyond activeLayerId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleRowSelect = useCallback(
    (layerId: string, displayIdx: number, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle this layer in the selection set; keep activeLayerId unchanged
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(layerId)) next.delete(layerId);
          else next.add(layerId);
          return next;
        });
      } else if (e.shiftKey && activeLayerId) {
        // Range select from activeLayer to clicked layer (both in display coords)
        const activeDisplayIdx = displayLayers.findIndex((l) => l.id === activeLayerId);
        if (activeDisplayIdx === -1) {
          setSelectedIds(new Set());
          useLayerStore.getState().setActiveLayer(layerId);
          return;
        }
        const lo = Math.min(activeDisplayIdx, displayIdx);
        const hi = Math.max(activeDisplayIdx, displayIdx);
        const rangeIds = new Set(displayLayers.slice(lo, hi + 1).map((l) => l.id));
        setSelectedIds(rangeIds);
        // Don't change activeLayerId on shift-click
      } else {
        // Normal click: clear selection and set active
        setSelectedIds(new Set());
        useLayerStore.getState().setActiveLayer(layerId);
      }
    },
    [activeLayerId, displayLayers],
  );

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

  const onDuplicate = () => {
    const toDup = selectedIds.size > 0 ? [...selectedIds] : activeLayerId ? [activeLayerId] : [];
    // Sort by array order so duplicates are inserted in a sensible sequence
    const sorted = toDup
      .map((id) => ({ id, idx: layers.findIndex((l) => l.id === id) }))
      .filter((x) => x.idx !== -1)
      .sort((a, b) => a.idx - b.idx);
    for (const { id } of sorted) {
      layerActions.duplicateLayer(id);
    }
    setSelectedIds(new Set());
  };

  const canMergeDown = useMemo(() => {
    if (!activeLayerId) return false;
    const idx = layers.findIndex((l) => l.id === activeLayerId);
    return idx > 0; // there is a layer below
  }, [layers, activeLayerId]);

  const onDelete = () => {
    // Delete all selected layers (or just the active one if no multi-select)
    const toDelete = selectedIds.size > 0 ? [...selectedIds] : activeLayerId ? [activeLayerId] : [];
    // Keep at least one layer
    const deletable = toDelete.filter((id) => {
      const remaining = layers.length - toDelete.length;
      return remaining > 0 && layers.some((l) => l.id === id);
    });
    // Remove in reverse array-order so indices stay valid
    const sorted = deletable
      .map((id) => ({ id, idx: layers.findIndex((l) => l.id === id) }))
      .filter((x) => x.idx !== -1)
      .sort((a, b) => b.idx - a.idx);
    // Refuse if it would empty the list
    if (sorted.length >= layers.length) {
      sorted.pop(); // keep one
    }
    for (const { id } of sorted) {
      layerActions.removeLayer(id);
    }
    setSelectedIds(new Set());
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
          <Tooltip content="Duplicate layer(s)" placement="left">
            <button
              type="button"
              className={styles.headerButton}
              aria-label="Duplicate layer"
              disabled={!activeLayerId}
              onClick={onDuplicate}
            >
              <LuCopy size={14} />
            </button>
          </Tooltip>
          <Tooltip content="Merge down" placement="left">
            <button
              type="button"
              className={styles.headerButton}
              aria-label="Merge down"
              disabled={!canMergeDown}
              onClick={() => { if (activeLayerId) layerActions.mergeDown(activeLayerId); }}
            >
              <LuMerge size={14} />
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
            selected={selectedIds.has(layer.id)}
            displayIdx={displayIdx}
            draggingDisplayIdx={dragSrc}
            dropDisplayIdx={dropInfo?.idx ?? null}
            dropOnTopHalf={dropInfo?.topHalf ?? false}
            onSelect={(e) => handleRowSelect(layer.id, displayIdx, e)}
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
          <input
            type="range"
            className={styles.opacitySlider}
            min={0}
            max={100}
            step={1}
            value={Math.round((activeLayer?.opacity ?? 1) * 100)}
            disabled={!activeLayer}
            aria-label="Layer opacity"
            style={{ '--pct': Math.round((activeLayer?.opacity ?? 1) * 100) } as React.CSSProperties}
            onChange={(e) => {
              if (activeLayer) layerActions.setLayerOpacity(activeLayer.id, e.target.valueAsNumber / 100);
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
