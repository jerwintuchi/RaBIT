import { useEffect, useRef } from 'react';
import { useNineSliceStore } from '../../../state/useNineSliceStore';
import { useProjectStore } from '../../../state/useProjectStore';
import { useFrameStore } from '../../../state/useFrameStore';
import { useLayerStore } from '../../../state/useLayerStore';
import styles from './NineSlicePanel.module.css';

// ── Nine-slice draw helper ──────────────────────────────────────────────────

function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  srcW: number,
  srcH: number,
  t: number,
  r: number,
  b: number,
  l: number,
  targetW: number,
  targetH: number,
): void {
  ctx.clearRect(0, 0, targetW, targetH);

  const cw = srcW - l - r;  // center width in source
  const ch = srcH - t - b;  // center height in source
  const dCW = targetW - l - r; // center width in dest
  const dCH = targetH - t - b; // center height in dest

  if (cw <= 0 || ch <= 0 || dCW <= 0 || dCH <= 0) return;

  // Corners
  ctx.drawImage(source, 0,       0,       l,  t,  0,             0,             l,    t);    // TL
  ctx.drawImage(source, srcW-r,  0,       r,  t,  targetW-r,     0,             r,    t);    // TR
  ctx.drawImage(source, 0,       srcH-b,  l,  b,  0,             targetH-b,     l,    b);    // BL
  ctx.drawImage(source, srcW-r,  srcH-b,  r,  b,  targetW-r,     targetH-b,     r,    b);    // BR

  // Edges
  ctx.drawImage(source, l,       0,       cw, t,  l,             0,             dCW,  t);    // Top
  ctx.drawImage(source, l,       srcH-b,  cw, b,  l,             targetH-b,     dCW,  b);    // Bottom
  ctx.drawImage(source, 0,       t,       l,  ch, 0,             t,             l,    dCH);  // Left
  ctx.drawImage(source, srcW-r,  t,       r,  ch, targetW-r,     t,             r,    dCH);  // Right

  // Center
  ctx.drawImage(source, l,       t,       cw, ch, l,             t,             dCW,  dCH);
}

// ── Component ───────────────────────────────────────────────────────────────

export function NineSlicePanel(): JSX.Element {
  const visible = useNineSliceStore((s) => s.visible);
  const margins = useNineSliceStore((s) => s.margins);
  const targetW = useNineSliceStore((s) => s.targetW);
  const targetH = useNineSliceStore((s) => s.targetH);
  const canvasW = useProjectStore((s) => s.canvas.width);
  const canvasH = useProjectStore((s) => s.canvas.height);
  const frames = useFrameStore((s) => s.frames);
  const activeFrameIndex = useFrameStore((s) => s.activeFrameIndex);
  const layers = useLayerStore((s) => s.layers);
  const dataVersions = useLayerStore((s) => s.dataVersions);

  const previewRef = useRef<HTMLCanvasElement>(null);

  const maxMarginW = Math.floor(canvasW / 2);
  const maxMarginH = Math.floor(canvasH / 2);

  // Clamp margins to canvas bounds
  const t = Math.min(margins.top, maxMarginH);
  const b = Math.min(margins.bottom, maxMarginH);
  const l = Math.min(margins.left, maxMarginW);
  const r = Math.min(margins.right, maxMarginW);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;

    const activeFrame = frames[activeFrameIndex];
    if (!activeFrame) return;

    // Composite all visible layers for the active frame onto an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasW;
    offscreen.height = canvasH;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Resolve linked cells: walk backward from active frame to find data
    const resolveCell = (layerId: string): Uint8ClampedArray | null => {
      for (let fi = activeFrameIndex; fi >= 0; fi--) {
        const frame = frames[fi];
        if (!frame) continue;
        const cell = frame.cells[layerId];
        if (!cell) continue;
        if (!cell.linked && cell.data) return cell.data;
        if (!cell.linked && !cell.data) return null;
        // cell.linked — continue backward
      }
      return null;
    };

    // Draw bottom-to-top
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer || !layer.visible) continue;
      const data = resolveCell(layer.id);
      if (!data) continue;
      // Copy into a plain ArrayBuffer to satisfy ImageData constructor typing
      const plain = new Uint8ClampedArray(data.length);
      plain.set(data);
      const imgData = new ImageData(plain, canvasW, canvasH);
      // Draw layer at opacity
      offCtx.globalAlpha = layer.opacity;
      const tmp = document.createElement('canvas');
      tmp.width = canvasW;
      tmp.height = canvasH;
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) {
        tmpCtx.putImageData(imgData, 0, 0);
        offCtx.drawImage(tmp, 0, 0);
      }
    }
    offCtx.globalAlpha = 1;

    // Resize preview canvas to targetW×targetH
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable smoothing for pixel art
    ctx.imageSmoothingEnabled = false;

    drawNineSlice(ctx, offscreen, canvasW, canvasH, t, r, b, l, targetW, targetH);
  }, [
    frames,
    activeFrameIndex,
    layers,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(dataVersions),
    canvasW,
    canvasH,
    t,
    r,
    b,
    l,
    targetW,
    targetH,
  ]);

  if (!visible) return <></>;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Nine-Slice Preview</span>
        <button
          className={styles.closeButton}
          onClick={() => useNineSliceStore.getState().setVisible(false)}
          title="Close"
          aria-label="Close nine-slice panel"
        >
          ×
        </button>
      </div>

      <div className={styles.body}>
        {/* Margin sliders */}
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
          const max = side === 'top' || side === 'bottom' ? maxMarginH : maxMarginW;
          const val = margins[side];
          return (
            <div key={side} className={styles.row}>
              <span className={styles.label}>{side.charAt(0).toUpperCase() + side.slice(1)}</span>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={max}
                value={Math.min(val, max)}
                onChange={(e) => useNineSliceStore.getState().setMargin(side, Number(e.target.value))}
              />
              <span className={styles.valueLabel}>{Math.min(val, max)}</span>
            </div>
          );
        })}

        <div className={styles.separator} />

        {/* Target size inputs */}
        <div className={styles.sizeRow}>
          <span className={styles.sizeLabel}>Target</span>
          <input
            type="number"
            className={styles.sizeInput}
            min={16}
            max={512}
            value={targetW}
            onChange={(e) => {
              const v = Math.min(512, Math.max(16, Number(e.target.value)));
              useNineSliceStore.getState().setTargetSize(v, targetH);
            }}
            aria-label="Target width"
          />
          <span className={styles.sizeSep}>×</span>
          <input
            type="number"
            className={styles.sizeInput}
            min={16}
            max={512}
            value={targetH}
            onChange={(e) => {
              const v = Math.min(512, Math.max(16, Number(e.target.value)));
              useNineSliceStore.getState().setTargetSize(targetW, v);
            }}
            aria-label="Target height"
          />
        </div>

        <div className={styles.separator} />

        {/* Preview */}
        <span className={styles.previewLabel}>Preview</span>
        <canvas
          ref={previewRef}
          className={styles.previewCanvas}
          aria-label="Nine-slice stretch preview"
        />
      </div>
    </div>
  );
}
