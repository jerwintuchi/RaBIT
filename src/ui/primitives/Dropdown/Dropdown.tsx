import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown } from '../../../assets/icons/IconChevronDown';
import styles from './Dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  width?: number | string;
  'aria-label'?: string;
  id?: string;
}

export function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled,
  width,
  'aria-label': ariaLabel,
  id,
}: DropdownProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const showFilter = options.length > 10;
  const filtered = filter ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())) : options;

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const close = useCallback(() => {
    setOpen(false);
    setFilter('');
    setHighlighted(-1);
    triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = Math.max(rect.width, 120);
    // Estimate panel height: 32px per option (max 8 visible) + optional filter row
    const estimatedPanelH = Math.min(filtered.length, 8) * 32 + (showFilter ? 40 : 0);
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const openUpward = spaceBelow < estimatedPanelH && spaceAbove > spaceBelow;
    const top = openUpward ? rect.top - estimatedPanelH - 2 : rect.bottom + 2;
    const rawLeft = rect.left;
    const left = rawLeft + panelWidth > window.innerWidth ? rect.right - panelWidth : rawLeft;

    setPanelStyle({ top, left, minWidth: panelWidth });
    if (showFilter) setTimeout(() => filterRef.current?.focus(), 0);
    else setHighlighted(filtered.findIndex((o) => o.value === value));
    // open is the only trigger we want — filtered/value changes don't reposition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
    if (e.key === 'Escape') close();
  };

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const enabledIndexes = filtered.map((_, i) => i).filter((i) => !filtered[i]?.disabled);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = enabledIndexes.find((i) => i > highlighted) ?? enabledIndexes[0] ?? -1;
      setHighlighted(next);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev =
        [...enabledIndexes].reverse().find((i) => i < highlighted) ?? enabledIndexes[enabledIndexes.length - 1] ?? -1;
      setHighlighted(prev);
    }
    if (e.key === 'Enter' && highlighted >= 0 && !filtered[highlighted]?.disabled) {
      const chosen = filtered[highlighted];
      if (chosen) {
        onChange(chosen.value);
        close();
      }
    }
    if (e.key === 'Escape' || e.key === 'Tab') close();
  };

  const triggerClasses = [styles.trigger, open && styles.open, disabled && styles.disabled].filter(Boolean).join(' ');

  return (
    <>
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        className={triggerClasses}
        style={width !== undefined ? { width } : undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={[styles.triggerLabel, !selectedLabel ? styles.placeholder : ''].filter(Boolean).join(' ')}>
          {selectedLabel ?? placeholder}
        </span>
        <IconChevronDown size={12} className={[styles.chevron, open ? styles.open : ''].filter(Boolean).join(' ')} />
      </div>

      {open &&
        createPortal(
          <div ref={panelRef} role="listbox" className={styles.panel} style={panelStyle} onKeyDown={onPanelKeyDown}>
            {showFilter && (
              <input
                ref={filterRef}
                type="text"
                className={styles.filterInput}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setHighlighted(0);
                }}
                placeholder="Filter…"
                aria-label="Filter options"
              />
            )}
            <div className={styles.optionList}>
              {filtered.map((opt, i) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  className={[
                    styles.option,
                    i === highlighted && styles.highlighted,
                    opt.value === value && styles.selected,
                    opt.disabled && styles.disabled,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => !opt.disabled && setHighlighted(i)}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      close();
                    }
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
