import { useState, useRef, useCallback, useEffect, cloneElement, isValidElement } from 'react';
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

// Conservative initial estimates — real size measured after first render
const EST_W = 240;
const EST_H = 56;

export function Tooltip({
  content,
  description,
  shortcut,
  placement = 'bottom',
  delay = 0,
  disabled,
  children,
}: TooltipProps): JSX.Element {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const childRef = useRef<Element | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // After the tooltip div mounts, measure its real size and re-clamp
  useEffect(() => {
    if (!anchor || !tipRef.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const tw = tip.width;
    const th = tip.height;
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = 0, left = 0;

    if (placement === 'bottom') {
      top = anchor.bottom + gap;
      left = anchor.left + anchor.width / 2 - tw / 2;
      if (top + th > vh) top = anchor.top - gap - th;
    } else if (placement === 'top') {
      top = anchor.top - gap - th;
      left = anchor.left + anchor.width / 2 - tw / 2;
      if (top < 0) top = anchor.bottom + gap;
    } else if (placement === 'right') {
      top = anchor.top + anchor.height / 2 - th / 2;
      left = anchor.right + gap;
      if (left + tw > vw) left = anchor.left - gap - tw;
    } else {
      top = anchor.top + anchor.height / 2 - th / 2;
      left = anchor.left - gap - tw;
      if (left < 0) left = anchor.right + gap;
    }

    top  = Math.max(4, Math.min(top,  vh - th - 4));
    left = Math.max(4, Math.min(left, vw - tw - 4));

    setPos({ top, left });
  }, [anchor, placement]);

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

      // Initial estimate — will be corrected in useEffect once tip renders
      if (placement === 'bottom') {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - EST_W / 2;
        if (top + EST_H > vh) top = rect.top - gap - EST_H;
      } else if (placement === 'top') {
        top = rect.top - gap - EST_H;
        left = rect.left + rect.width / 2 - EST_W / 2;
        if (top < 0) top = rect.bottom + gap;
      } else if (placement === 'right') {
        top = rect.top + rect.height / 2 - EST_H / 2;
        left = rect.right + gap;
        if (left + EST_W > vw) left = rect.left - gap - EST_W;
      } else {
        top = rect.top + rect.height / 2 - EST_H / 2;
        left = rect.left - gap - EST_W;
        if (left < 0) left = rect.right + gap;
      }

      top  = Math.max(4, Math.min(top,  vh - EST_H - 4));
      left = Math.max(4, Math.min(left, vw - EST_W - 4));

      setPos({ top, left });
      setAnchor(rect);
    }, delay);
  }, [disabled, placement, delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(null);
    setAnchor(null);
  }, []);

  if (!isValidElement(children)) return children as JSX.Element;

  const p = children.props as ChildWithHandlers;

  const child = cloneElement(children, {
    ref: (el: Element | null) => { childRef.current = el; },
    onMouseEnter: (e: React.MouseEvent) => { p.onMouseEnter?.(e as never); show(); },
    onMouseLeave: (e: React.MouseEvent) => { p.onMouseLeave?.(e as never); hide(); },
    onFocus:      (e: React.FocusEvent) => { p.onFocus?.(e as never);      show(); },
    onBlur:       (e: React.FocusEvent) => { p.onBlur?.(e as never);       hide(); },
  } as React.HTMLAttributes<Element>);

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <div
            ref={tipRef}
            className={styles.tooltip}
            style={{ top: pos.top, left: pos.left }}
          >
            <span className={styles.label}>{content}</span>
            {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
            {description && <span className={styles.description}>{description}</span>}
          </div>,
          document.body,
        )}
    </>
  );
}
