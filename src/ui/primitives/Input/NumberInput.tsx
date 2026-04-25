import { useRef } from 'react';
import { useScrub } from '../../hooks/useScrub';
import styles from './Input.module.css';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  label?: string;
  unit?: string;
  scrubSensitivity?: number;
  id?: string;
  'aria-label'?: string;
}

export function NumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  disabled,
  label,
  unit,
  scrubSensitivity = 1,
  id,
  'aria-label': ariaLabel,
}: NumberInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const { onPointerDown, scrubbing } = useScrub({
    value,
    onChange,
    min,
    max,
    sensitivity: scrubSensitivity,
  });

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const format = (v: number) => v.toFixed(precision);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(clamp(value + step));
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(clamp(value - step));
    }
  };

  return (
    <div className={styles.numberWrapper}>
      {label && (
        <span
          className={[styles.numberLabel, scrubbing ? styles.scrubbing : ''].join(' ')}
          onPointerDown={disabled ? undefined : onPointerDown}
          title="Drag to scrub"
        >
          {label}
        </span>
      )}
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          id={id}
          type="number"
          value={format(value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={styles.numberInput}
          aria-label={ariaLabel ?? label}
        />
        <div className={styles.spinners}>
          <button
            type="button"
            className={styles.spinnerBtn}
            tabIndex={-1}
            disabled={disabled ?? value >= max}
            onClick={() => onChange(clamp(value + step))}
            aria-label="Increment"
          >
            ▲
          </button>
          <button
            type="button"
            className={styles.spinnerBtn}
            tabIndex={-1}
            disabled={disabled ?? value <= min}
            onClick={() => onChange(clamp(value - step))}
            aria-label="Decrement"
          >
            ▼
          </button>
        </div>
      </div>
      {unit && <span className={styles.unit}>{unit}</span>}
    </div>
  );
}
