import { useEffect, useRef, useState } from 'react';
import { useLayerStore } from '../../state/useLayerStore';
import { useUIStore } from '../../state/useUIStore';
import { MenuItem } from './FileMenu';
import styles from './FileMenu.module.css';

export function CanvasMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasProject = useLayerStore((s) => s.layers.length > 0);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function getDropdownPos() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return { top: 28, left: 0 };
    return { top: r.bottom + 4, left: r.left };
  }

  const pos = open ? getDropdownPos() : { top: 28, left: 0 };

  return (
    <>
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => { if (hasProject) setOpen((v) => !v); }}
        disabled={!hasProject}
        title={hasProject ? undefined : 'No project open'}
      >
        Canvas
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: pos.top, left: pos.left }}
        >
          <MenuItem
            label="Resize Canvas…"
            onClick={() => { setOpen(false); useUIStore.getState().showResizeCanvasDialog(); }}
          />
        </div>
      )}
    </>
  );
}
