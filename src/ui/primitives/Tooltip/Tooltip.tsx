import { useState, useRef, useCallback, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string;
  shortcut?: string;
  placement?: Placement;
  delay?: number;
  disabled?: boolean;
  children: React.ReactElement;
}

type AnyHandler = (e: never) => void;

interface ChildWithHandlers {
  onMouseEnter?: AnyHandler;
  onMouseLeave?: AnyHandler;
  onFocus?: AnyHandler;
  onBlur?: AnyHandler;
}

export function Tooltip({
  content,
  shortcut,
  placement = 'bottom',
  delay = 500,
  disabled,
  children,
}: TooltipProps): JSX.Element {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const childRef = useRef<Element | null>(null);

  const show = useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      const el = childRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 6;
      let top = 0,
        left = 0;
      if (placement === 'bottom') {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
      } else if (placement === 'top') {
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
      } else if (placement === 'right') {
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
      } else {
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
      }
      setPos({ top, left });
    }, delay);
  }, [disabled, placement, delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(null);
  }, []);

  if (!isValidElement(children)) return children as JSX.Element;

  const p = children.props as ChildWithHandlers;

  const child = cloneElement(children, {
    ref: (el: Element | null) => {
      childRef.current = el;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      p.onMouseEnter?.(e as never);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      p.onMouseLeave?.(e as never);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      p.onFocus?.(e as never);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      p.onBlur?.(e as never);
      hide();
    },
  } as React.HTMLAttributes<Element>);

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <div className={styles.tooltip} style={{ top: pos.top, left: pos.left }}>
            {content}
            {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
          </div>,
          document.body,
        )}
    </>
  );
}
