import type { ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'icon';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  kbd?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  children?: ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

const variantClass: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
};

const sizeClass: Record<ButtonSize, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  icon: styles.icon,
};

export function Button({
  variant = 'secondary',
  size = 'md',
  disabled,
  kbd,
  onClick,
  type = 'button',
  children,
  className,
  title,
  'aria-label': ariaLabel,
}: ButtonProps): JSX.Element {
  const classes = [styles.button, variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ');

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes} title={title} aria-label={ariaLabel}>
      {children}
      {kbd && <kbd className={styles.kbd}>{kbd}</kbd>}
    </button>
  );
}
