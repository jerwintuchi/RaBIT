import { useEffect, useState } from 'react';
import { usePaletteStore } from '../../../state/usePaletteStore';
import { rgbaToHex, parseHex } from '../../../state/colorUtils';
import { Input } from '../../primitives';
import styles from './Picker.module.css';

/**
 * Hex input. Accepts 6-char (RRGGBB), 8-char (RRGGBBAA), and 3/4-char shorthand
 * forms with or without leading `#`. Live-validates while typing — only commits
 * to the store when the value parses successfully.
 */
export function HexPicker(): JSX.Element {
  const primary = usePaletteStore((s) => s.primaryColor);
  const canonical = rgbaToHex(primary);
  const [draft, setDraft] = useState(canonical);
  const [invalid, setInvalid] = useState(false);

  // Sync draft when the primary color changes externally (palette click, eyedropper)
  useEffect(() => {
    setDraft(canonical);
    setInvalid(false);
  }, [canonical]);

  const onCommit = (raw: string) => {
    const parsed = parseHex(raw);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    usePaletteStore.getState().setPrimaryColor(parsed);
  };

  return (
    <div className={styles.hexRow}>
      <span className={styles.channelLabel}>#</span>
      <Input
        value={draft.replace(/^#/, '')}
        onChange={(v) => {
          setDraft(v);
          // Live preview: try to parse as the user types
          const parsed = parseHex(v);
          if (parsed !== null) {
            setInvalid(false);
            usePaletteStore.getState().setPrimaryColor(parsed);
          } else {
            setInvalid(true);
          }
        }}
        onBlur={() => onCommit(draft)}
        invalid={invalid}
        maxLength={9} // "#RRGGBBAA"
        aria-label="Hex color"
      />
    </div>
  );
}
