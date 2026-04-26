import { usePaletteStore } from '../../../state/usePaletteStore';
import { rgbaToHex } from '../../../state/colorUtils';
import { Tooltip } from '../../primitives';
import styles from './ColorHistory.module.css';

/** Recently-used color strip. Click to restore a color as primary. */
export function ColorHistory(): JSX.Element | null {
  const history = usePaletteStore((s) => s.colorHistory);

  if (history.length === 0) return null;

  return (
    <div className={styles.strip} aria-label="Recent colors">
      {history.map((color, i) => (
        <Tooltip key={`${i}-${color}`} content={rgbaToHex(color)} placement="top">
          <button
            type="button"
            className={styles.swatch}
            style={{ background: rgbaToHex(color) }}
            aria-label={`Recent color ${rgbaToHex(color)}`}
            onClick={() => usePaletteStore.getState().setPrimaryColor(color)}
          />
        </Tooltip>
      ))}
    </div>
  );
}
