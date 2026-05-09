import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../../state/useUIStore';
import { useToolStore } from '../../state/useToolStore';
import { ZOOM_LEVELS, snapZoom } from '../../state/zoomLevels';

export interface ViewportInteractionState {
  /** True while pan is active (space-drag or middle-drag) — tools should ignore pointer events. */
  inputClaimedRef: React.MutableRefObject<boolean>;
}

/** Wires pan (Space+drag or middle-click drag) and zoom (Ctrl+scroll, Ctrl+=/−) onto a container element. */
export function useViewportInteraction(
  containerRef: React.RefObject<HTMLElement | null>,
  canvasW: number,
  canvasH: number,
): ViewportInteractionState {
  // Reactive reads — used only to keep stateRef in sync
  const zoomLevel = useUIStore((s) => s.zoomLevel);
  const panOffset = useUIStore((s) => s.panOffset);

  // Stable ref so event handlers read latest values without re-attachment
  const stateRef = useRef({ zoomLevel, panOffset, canvasW, canvasH });
  stateRef.current = { zoomLevel, panOffset, canvasW, canvasH };

  // True while pan input is active — checked by the tool pointer handler
  const inputClaimedRef = useRef(false);

  const fitToWindow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const { canvasW: cw, canvasH: ch } = stateRef.current;
    const scale = Math.min(vw / cw, vh / ch);
    const zoom = ZOOM_LEVELS.reduce((best, z) =>
      Math.abs(z - scale) < Math.abs(best - scale) ? z : best,
    );
    const panX = (vw - cw * zoom) / 2;
    const panY = (vh - ch * zoom) / 2;
    // Call via getState() to avoid React subscription overhead and unbound-method lint
    useUIStore.getState().setZoomLevel(zoom);
    useUIStore.getState().setPanOffset({ x: panX, y: panY });
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isPanning = false;
    let isSpaceDown = false;
    let lastPointer = { x: 0, y: 0 };
    let savedCursor = '';

    const onPointerDown = (e: PointerEvent) => {
      const isHandActive = useToolStore.getState().activeTool === 'hand';
      if (e.button === 1 || (e.button === 0 && (isSpaceDown || isHandActive))) {
        isPanning = true;
        inputClaimedRef.current = true;
        lastPointer = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const { panOffset, zoomLevel } = stateRef.current;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      useUIStore.getState().setCursorPosition({
        x: Math.floor((screenX - panOffset.x) / zoomLevel),
        y: Math.floor((screenY - panOffset.y) / zoomLevel),
      });

      if (!isPanning) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };
      const { panOffset: cur } = stateRef.current;
      useUIStore.getState().setPanOffset({ x: cur.x + dx, y: cur.y + dy });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPanning) {
        isPanning = false;
        inputClaimedRef.current = false;
        el.releasePointerCapture(e.pointerId);
      }
    };

    const onPointerLeave = () => {
      useUIStore.getState().setCursorPosition(null);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const { zoomLevel, panOffset } = stateRef.current;
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newZoom = snapZoom(zoomLevel, e.deltaY < 0 ? 'in' : 'out');
      if (newZoom === zoomLevel) return;

      // Keep the canvas point under the cursor fixed
      const canvasX = (mouseX - panOffset.x) / zoomLevel;
      const canvasY = (mouseY - panOffset.y) / zoomLevel;
      useUIStore.getState().setZoomLevel(newZoom);
      useUIStore.getState().setPanOffset({
        x: mouseX - canvasX * newZoom,
        y: mouseY - canvasY * newZoom,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpaceDown) {
        isSpaceDown = true;
        savedCursor = el.style.cursor;
        el.style.cursor = 'grab';
        e.preventDefault();
      }
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const { zoomLevel, panOffset } = stateRef.current;
          const cx = el.clientWidth / 2;
          const cy = el.clientHeight / 2;
          const newZoom = snapZoom(zoomLevel, 'in');
          const canvasX = (cx - panOffset.x) / zoomLevel;
          const canvasY = (cy - panOffset.y) / zoomLevel;
          useUIStore.getState().setZoomLevel(newZoom);
          useUIStore.getState().setPanOffset({
            x: cx - canvasX * newZoom,
            y: cy - canvasY * newZoom,
          });
        }
        if (e.key === '-') {
          e.preventDefault();
          const { zoomLevel, panOffset } = stateRef.current;
          const cx = el.clientWidth / 2;
          const cy = el.clientHeight / 2;
          const newZoom = snapZoom(zoomLevel, 'out');
          const canvasX = (cx - panOffset.x) / zoomLevel;
          const canvasY = (cy - panOffset.y) / zoomLevel;
          useUIStore.getState().setZoomLevel(newZoom);
          useUIStore.getState().setPanOffset({
            x: cx - canvasX * newZoom,
            y: cy - canvasY * newZoom,
          });
        }
        if (e.key === '0') {
          e.preventDefault();
          fitToWindow();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDown = false;
        el.style.cursor = savedCursor;
        // If pan ends by releasing space (not pointer), release the input claim too
        if (isPanning) {
          isPanning = false;
          inputClaimedRef.current = false;
        }
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [containerRef, fitToWindow]);

  // Auto-fit when canvas dimensions change
  useEffect(() => {
    fitToWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH]);

  return { inputClaimedRef };
}
