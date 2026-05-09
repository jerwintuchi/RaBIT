import { useEffect, useRef, useState } from 'react';

interface DropdownMenu {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  dropdownRef: React.RefObject<HTMLDivElement>;
  getDropdownPos: () => { top: number; left: number };
}

export function useDropdownMenu(): DropdownMenu {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function close() { setOpen(false); }

  function getDropdownPos() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return { top: 28, left: 0 };
    return { top: r.bottom + 4, left: r.left };
  }

  return { open, setOpen, close, triggerRef, dropdownRef, getDropdownPos };
}
