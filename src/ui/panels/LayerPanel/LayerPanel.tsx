import { useMemo } from 'react';
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

  // Display order: top of list = top of stack visually = end of array
  const displayLayers = useMemo(() => [...layers].reverse(), [layers]);

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
        {displayLayers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            active={layer.id === activeLayerId}
            onSelect={() => useLayerStore.getState().setActiveLayer(layer.id)}
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
