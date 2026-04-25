import { usePaletteStore } from '../../../state/usePaletteStore';
import { unpackRGBA, packRGBA } from '../../../state/colorUtils';
import { Slider, NumberInput } from '../../primitives';
import styles from './Picker.module.css';

const CHANNELS = ['R', 'G', 'B', 'A'] as const;
type Channel = (typeof CHANNELS)[number];

export function RgbPicker(): JSX.Element {
  const primary = usePaletteStore((s) => s.primaryColor);
  const [r, g, b, a] = unpackRGBA(primary);
  const values: Record<Channel, number> = { R: r, G: g, B: b, A: a };

  const setChannel = (ch: Channel, v: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(v)));
    const next = { ...values, [ch]: clamped };
    usePaletteStore
      .getState()
      .setPrimaryColor(packRGBA(next.R, next.G, next.B, next.A));
  };

  return (
    <div className={styles.rgbGrid}>
      {CHANNELS.map((ch) => (
        <div key={ch} className={styles.row}>
          <span className={styles.channelLabel}>{ch}</span>
          <Slider
            value={values[ch]}
            min={0}
            max={255}
            step={1}
            showValue={false}
            aria-label={`${ch} channel`}
            onChange={(v) => setChannel(ch, v)}
          />
          <div className={styles.numberInput}>
            <NumberInput
              value={values[ch]}
              min={0}
              max={255}
              step={1}
              aria-label={`${ch} value`}
              onChange={(v) => setChannel(ch, v)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
