import { useRef, useEffect } from 'react';
import { IconCheck } from '../../../assets/icons/IconCheck';
import styles from './Checkbox.module.css';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Checkbox({ checked, onChange, label, disabled, id }: CheckboxProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const isIndeterminate = checked === 'indeterminate';
  const isChecked = checked === true;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const boxClass = [styles.box, isChecked && styles.checked, isIndeterminate && styles.indeterminate]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={[styles.wrapper, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}>
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        checked={isChecked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.hiddenInput}
      />
      <span className={boxClass}>
        {isChecked && <IconCheck size={10} color="#fff" stroke="#fff" />}
        {isIndeterminate && <span className={styles.dash} />}
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
