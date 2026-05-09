import { useState, useRef, useCallback, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string;
  description?: string;
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

// Estimated tooltip dimensions for viewport clamping (generous upper bound)
const TIP_W = 200;
const TIP_H = 48;

export function Tooltip({
  content,
  description,
  shortcut,
  placement = 'bottom',
  delay = 0,
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
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = 0, left = 0;

      // Compute preferred position
      if (placement === 'bottom') {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        // Flip to top if not enough room below
        if (top + TIP_H > vh) top = rect.top - gap - TIP_H;
      } else if (placement === 'top') {
        top = rect.top - gap - TIP_H;
        left = rect.left + rect.width / 2;
        // Flip to bottom if not enough room above
        if (top < 0) top = rect.bottom + gap;
      } else if (placement === 'right') {
        top = rect.top + rect.height / 2 - TIP_H / 2;
        left = rect.right + gap;
        // Flip to left if not enough room right
        if (left + TIP_W > vw) left = rect.left - gap - TIP_W;
      } else {
        top = rect.top + rect.height / 2 - TIP_H / 2;
        left = rect.left - gap - TIP_W;
        // Flip to right if not enough room left
        if (left < 0) left = rect.right + gap;
      }

      // Clamp to viewport bounds
      top = Math.max(4, Math.min(top, vh - TIP_H - 4));
      left = Math.max(4, Math.min(left, vw - TIP_W - 4));

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
            <span className={styles.label}>{content}</span>
            {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
            {description && <span className={styles.description}>{description}</span>}
          </div>,
          document.body,
        )}
    </>
  );
}
