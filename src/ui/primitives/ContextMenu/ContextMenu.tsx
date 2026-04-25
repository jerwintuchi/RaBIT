import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronRight } from '../../../assets/icons/IconChevronRight';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  type: 'item' | 'separator' | 'submenu';
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  anchor: { x: number; y: number };
  onClose: () => void;
}

function clampPosition(x: number, y: number, w: number, h: number) {
  const cx = x + w > window.innerWidth ? x - w : x;
  const cy = y + h > window.innerHeight ? y - h : y;
  return { x: Math.max(0, cx), y: Math.max(0, cy) };
}

function MenuList({
  items,
  style,
  onClose,
}: {
  items: ContextMenuItem[];
  style: React.CSSProperties;
  onClose: () => void;
}): JSX.Element {
  const [submenuIndex, setSubmenuIndex] = useState(-1);
  const [submenuPos, setSubmenuPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openSubmenu = (i: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setSubmenuPos({ x: rect.right + 2, y: rect.top });
    setSubmenuIndex(i);
  };

  return (
    <div ref={menuRef} className={styles.menu} style={style}>
      {items.map((item, i) => {
        if (item.type === 'separator') return <div key={i} className={styles.separator} />;

        const itemClass = [styles.item, item.danger && styles.danger, item.disabled && styles.disabled]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={i}
            className={itemClass}
            onClick={() => {
              if (!item.disabled && item.type === 'item') {
                item.onClick?.();
                onClose();
              }
            }}
            onMouseEnter={(e) => {
              if (timerRef.current) clearTimeout(timerRef.current);
              if (item.type === 'submenu') {
                timerRef.current = setTimeout(() => openSubmenu(i, e.currentTarget), 100);
              } else {
                setSubmenuIndex(-1);
              }
            }}
          >
            <span className={styles.itemLabel}>{item.label}</span>
            {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
            {item.type === 'submenu' && <IconChevronRight size={12} className={styles.submenuArrow} />}
          </div>
        );
      })}
      {submenuIndex >= 0 && items[submenuIndex]?.children && (
        <MenuList
          items={items[submenuIndex]?.children ?? []}
          style={{ top: submenuPos.y, left: submenuPos.x }}
          onClose={onClose}
        />
      )}
    </div>
  );
}

export function ContextMenu({ items, anchor, onClose }: ContextMenuProps): JSX.Element {
  const pos = clampPosition(anchor.x, anchor.y, 180, items.length * 26 + 8);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Close if the click is outside any menu
      const menus = document.querySelectorAll('[class*="menu"]');
      const inside = Array.from(menus).some((m) => m.contains(target));
      if (!inside) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(<MenuList items={items} style={{ top: pos.y, left: pos.x }} onClose={onClose} />, document.body);
}
