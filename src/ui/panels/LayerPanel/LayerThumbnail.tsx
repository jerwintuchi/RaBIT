import { useEffect, useRef } from 'react';
import { useLayerStore } from '../../../state/useLayerStore';
import { useFrameStore } from '../../../state/useFrameStore';
import { useProjectStore } from '../../../state/useProjectStore';
import { resolveCell } from '../../../state/action-composers/frame-utils';
import styles from './LayerThumbnail.module.css';

const SIZE = 24;
const THROTTLE_MS = 250; // ≤4Hz per design-system.md §6.1

interface LayerThumbnailProps {
  layerId: string;
}

export function LayerThumbnail({ layerId }: LayerThumbnailProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const lastRenderRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-render when this layer's pixels change OR when the active frame changes
  const version = useLayerStore((s) => s.dataVersions[layerId] ?? 0);
  const activeFrameIndex = useFrameStore((s) => s.activeFrameIndex);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { frames } = useFrameStore.getState();
      const { width: srcW, height: srcH } = useProjectStore.getState().canvas;
      const data = resolveCell(frames, activeFrameIndex, layerId);

      ctx.clearRect(0, 0, SIZE, SIZE);
      if (!data) return;

      // Stage the cell into an offscreen canvas at native resolution, then
      // downscale into the visible 24×24 with smoothing off (pixelated look).
      let off = offscreenRef.current;
      if (!off || off.width !== srcW || off.height !== srcH) {
        off = document.createElement('canvas');
        off.width = srcW;
        off.height = srcH;
        offscreenRef.current = off;
      }
      const offCtx = off.getContext('2d');
      if (!offCtx) return;
      offCtx.putImageData(new ImageData(new Uint8ClampedArray(data), srcW, srcH), 0, 0);

      ctx.imageSmoothingEnabled = false;
      // Letterbox into the square: scale by min(SIZE/srcW, SIZE/srcH) and center
      const scale = Math.min(SIZE / srcW, SIZE / srcH);
      const dw = srcW * scale;
      const dh = srcH * scale;
      ctx.drawImage(off, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
    };

    const now = performance.now();
    const sinceLast = now - lastRenderRef.current;

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    if (sinceLast >= THROTTLE_MS) {
      // Leading edge — render immediately
      draw();
      lastRenderRef.current = now;
    } else {
      // Trailing edge — schedule render at the throttle window's end
      pendingTimerRef.current = setTimeout(() => {
        draw();
        lastRenderRef.current = performance.now();
        pendingTimerRef.current = null;
      }, THROTTLE_MS - sinceLast);
    }

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [layerId, version, activeFrameIndex]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.thumbnail}
      width={SIZE}
      height={SIZE}
      aria-hidden
    />
  );
}
