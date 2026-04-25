import styles from './Input.module.css';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  type?: 'text' | 'email' | 'search';
  maxLength?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export function Input({
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  type = 'text',
  maxLength,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
}: InputProps): JSX.Element {
  const classes = [styles.input, invalid && styles.invalid, className].filter(Boolean).join(' ');

  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={classes}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      aria-invalid={invalid}
    />
  );
}
