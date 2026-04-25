import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps): JSX.Element {
  return (
    <label className={[styles.wrapper, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        id={id}
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.hiddenInput}
        aria-checked={checked}
      />
      <span className={[styles.pill, checked ? styles.on : ''].filter(Boolean).join(' ')}>
        <span className={[styles.thumb, checked ? styles.on : ''].filter(Boolean).join(' ')} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
