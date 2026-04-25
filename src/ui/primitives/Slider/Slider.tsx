import { useRef, useCallback } from 'react';
import styles from './Slider.module.css';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  disabled,
  'aria-label': ariaLabel,
}: SliderProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);

  const percent = ((value - min) / (max - min)) * 100;

  const updateFromPointer = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = (e.clientX - rect.left) / rect.width;
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, stepped)));
    },
    [min, max, step, onChange],
  );

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromPointer(e);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, Math.max(min, value + step)));
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.min(max, Math.max(min, value - step)));
    }
    if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    }
    if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div className={[styles.wrapper, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}>
      {label && <span className={styles.label}>{label}</span>}
      <div
        ref={trackRef}
        className={styles.trackWrapper}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
      >
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
        <div
          className={styles.thumb}
          style={{ left: `${percent}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={ariaLabel ?? label}
          aria-disabled={disabled}
          onKeyDown={onKeyDown}
        />
      </div>
      {showValue && (
        <input
          type="number"
          className={styles.valueInput}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          aria-label={`${ariaLabel ?? label ?? ''} value`}
        />
      )}
    </div>
  );
}
