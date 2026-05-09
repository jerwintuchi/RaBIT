import { useRef, useState, type PointerEvent } from 'react';
import { usePaletteStore } from '../../../state/usePaletteStore';
import {
  rgbToHsv,
  hsvToRgb,
  unpackRGBA,
  packRGBA,
  rgbaToHex,
} from '../../../state/colorUtils';
import { NumberInput } from '../../primitives';
import styles from './HsvPicker.module.css';

// Dimensions live in CSS (160×160 SV square, 160×12 bars per design-system §6.2).

export function HsvPicker(): JSX.Element {
  const primary = usePaletteStore((s) => s.primaryColor);
  const [r, g, b, a] = unpackRGBA(primary);
  const { h: derivedH, s, v } = rgbToHsv(r, g, b);

  // Preserve last meaningful hue across desaturated states (sat = 0 produces
  // gray, which has no hue — without preservation, the SV square would flip
  // back to red).
  const lastHueRef = useRef(derivedH);
  if (s > 0) lastHueRef.current = derivedH;
  const h = lastHueRef.current;
  // When s=0, changing hue doesn't change primaryColor so React won't re-render.
  // This counter forces a re-render so the hue marker moves visually.
  const [, forceHueRerender] = useState(0);

  const apply = (newH: number, newS: number, newV: number, newA: number) => {
    const rgb = hsvToRgb(newH, newS, newV);
    usePaletteStore.getState().setPrimaryColor(packRGBA(rgb.r, rgb.g, rgb.b, newA));
  };

  // ── Pointer-driven drag helpers ──────────────────────────────────────────

  function makeDragHandler(
    onUpdate: (relX: number, relY: number, rect: DOMRect) => void,
  ) {
    const move = (e: PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      onUpdate(x, y, rect);
    };
    const down = (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      onUpdate(x, y, rect);
    };
    return { onPointerDown: down, onPointerMove: move };
  }

  const svDrag = makeDragHandler((x, y, rect) => {
    apply(h, (x / rect.width) * 100, (1 - y / rect.height) * 100, a);
  });
  const hueDrag = makeDragHandler((x, _y, rect) => {
    const newH = (x / rect.width) * 360;
    lastHueRef.current = newH;
    apply(newH, s, v, a);
    // If s=0, primaryColor won't change so React won't re-render — force it so the marker moves
    if (s === 0) forceHueRerender((n) => n + 1);
  });
  const alphaDrag = makeDragHandler((x, _y, rect) => {
    apply(h, s, v, Math.round((x / rect.width) * 255));
  });

  // ── Render ───────────────────────────────────────────────────────────────

  // Solid color at full sat/val for the SV square base
  const hueOnly = hsvToRgb(h, 100, 100);
  const hueRgb = `rgb(${hueOnly.r}, ${hueOnly.g}, ${hueOnly.b})`;
  // Opaque version of the current color for the alpha bar gradient
  const opaqueHex = rgbaToHex(packRGBA(r, g, b, 255), false);

  return (
    <div className={styles.hsv}>
      <div
        className={styles.svSquare}
        style={{ '--hue-color': hueRgb } as React.CSSProperties}
        role="slider"
        aria-label="Saturation and value"
        aria-valuetext={`S ${Math.round(s)}%, V ${Math.round(v)}%`}
        {...svDrag}
      >
        <div
          className={styles.svMarker}
          style={{ left: `${s}%`, top: `${100 - v}%` }}
        />
      </div>

      <div
        className={styles.hueBar}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(h)}
        {...hueDrag}
      >
        <div className={styles.hueMarker} style={{ left: `${(h / 360) * 100}%` }} />
      </div>

      <div
        className={styles.alphaBar}
        role="slider"
        aria-label="Alpha"
        aria-valuemin={0}
        aria-valuemax={255}
        aria-valuenow={a}
        {...alphaDrag}
        style={
          {
            '--alpha-grad-end': opaqueHex,
          } as React.CSSProperties
        }
      >
        <div className={styles.alphaMarker} style={{ left: `${(a / 255) * 100}%` }} />
      </div>

      <div className={styles.numberRow}>
        <Field label="H">
          <NumberInput
            value={Math.round(h)}
            min={0}
            max={360}
            step={1}
            aria-label="Hue"
            onChange={(nv) => {
              lastHueRef.current = nv;
              apply(nv, s, v, a);
            }}
          />
        </Field>
        <Field label="S">
          <NumberInput
            value={Math.round(s)}
            min={0}
            max={100}
            step={1}
            aria-label="Saturation"
            onChange={(nv) => apply(h, nv, v, a)}
          />
        </Field>
        <Field label="V">
          <NumberInput
            value={Math.round(v)}
            min={0}
            max={100}
            step={1}
            aria-label="Value"
            onChange={(nv) => apply(h, s, nv, a)}
          />
        </Field>
        <Field label="A">
          <NumberInput
            value={a}
            min={0}
            max={255}
            step={1}
            aria-label="Alpha"
            onChange={(nv) => apply(h, s, v, nv)}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}
