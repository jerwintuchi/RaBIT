import { usePaletteStore } from '../../../state/usePaletteStore';
import { rgbaToHex } from '../../../state/colorUtils';
import { IconSwap } from '../../../assets/icons';
import { Tooltip } from '../../primitives';
import styles from './ColorWells.module.css';

/** Primary + secondary color wells with swap (X) and reset (D) controls. */
export function ColorWells(): JSX.Element {
  const primary = usePaletteStore((s) => s.primaryColor);
  const secondary = usePaletteStore((s) => s.secondaryColor);
  const indexedMode = usePaletteStore((s) => s.indexedMode);
  const swatches = usePaletteStore((s) => s.palette.swatches);
  const primaryOutOfPalette = indexedMode && swatches.length > 0 && !swatches.some((s) => s.color === primary);

  return (
    <div className={styles.wells}>
      <div className={styles.swatchStack}>
        <Tooltip content="Secondary color" placement="top">
          <button
            type="button"
            className={`${styles.swatch} ${styles.secondary}`}
            style={{ background: rgbaToHex(secondary) }}
            aria-label={`Secondary color ${rgbaToHex(secondary)}`}
            onClick={() => {
              usePaletteStore.getState().pushColorHistory(primary);
              usePaletteStore.getState().swapColors();
            }}
          />
        </Tooltip>
        <Tooltip
          content={primaryOutOfPalette ? 'Primary color (not in palette — will snap on paint)' : 'Primary color'}
          placement="top"
        >
          <button
            type="button"
            className={`${styles.swatch} ${styles.primary}`}
            style={{ background: rgbaToHex(primary) }}
            aria-label={`Primary color ${rgbaToHex(primary)}`}
          >
            {primaryOutOfPalette && (
              <span style={{
                position: 'absolute', bottom: 1, right: 1,
                fontSize: 8, lineHeight: 1, color: '#ffcc00',
                pointerEvents: 'none', userSelect: 'none',
              }}>⚠</span>
            )}
          </button>
        </Tooltip>
      </div>
      <div className={styles.controls}>
        <Tooltip content="Swap colors (X)" placement="left">
          <button
            type="button"
            className={styles.controlButton}
            aria-label="Swap colors"
            onClick={() => {
              usePaletteStore.getState().pushColorHistory(primary);
              usePaletteStore.getState().swapColors();
            }}
          >
            <IconSwap />
          </button>
        </Tooltip>
        <Tooltip content="Reset to black/white (D)" placement="left">
          <button
            type="button"
            className={styles.resetSwatches}
            aria-label="Reset colors to black and white"
            onClick={() => usePaletteStore.getState().resetColors()}
          />
        </Tooltip>
      </div>
    </div>
  );
}
