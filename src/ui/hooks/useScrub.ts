import { useRef, useCallback } from 'react';

interface UseScrubOptions {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  sensitivity?: number;
}

interface UseScrubResult {
  onPointerDown: (e: React.PointerEvent<Element>) => void;
  scrubbing: boolean;
}

export function useScrub({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  sensitivity = 1,
}: UseScrubOptions): UseScrubResult {
  const scrubbingRef = useRef(false);
  const accumulatorRef = useRef(0);
  const baseValueRef = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      scrubbingRef.current = true;
      accumulatorRef.current = 0;
      baseValueRef.current = value;

      const el = e.currentTarget;
      void el.requestPointerLock();

      const onMove = (ev: PointerEvent) => {
        if (!scrubbingRef.current) return;
        accumulatorRef.current += ev.movementX * sensitivity;
        const next = Math.min(max, Math.max(min, baseValueRef.current + Math.round(accumulatorRef.current)));
        onChange(next);
      };

      const onUp = () => {
        scrubbingRef.current = false;
        document.exitPointerLock();
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [value, onChange, min, max, sensitivity],
  );

  return { onPointerDown, scrubbing: scrubbingRef.current };
}
