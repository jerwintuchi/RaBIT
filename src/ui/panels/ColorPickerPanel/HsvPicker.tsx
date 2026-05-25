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

export function HsvPicker(): JSX.Element {
  const primary = usePaletteStore((s) => s.primaryColor);
  const [r, g, b, a] = unpackRGBA(primary);
  const { h: derivedH, s: derivedS, v: derivedV } = rgbToHsv(r, g, b);

  // ── Stable HSV intent refs ────────────────────────────────────────────────
  // hRef/sRef/vRef store the INTENDED values so that the HSV→RGB→HSV
  // quantization round-trip doesn't corrupt them. Without this, incrementing H
  // by 1° can map to the same integer RGB as the previous value, snap derivedH
  // back to the old value, and leave the spinner stuck.
  const hRef = useRef(derivedH);
  const sRef = useRef(derivedS);
  const vRef = useRef(derivedV);

  // Detect external primary changes (palette click, undo, swatch pick) by
  // comparing what we'd expect from our stored intent against the actual store.
  // If they diverge, an external source changed the color — sync the refs.
  const expectedRGB = hsvToRgb(hRef.current, sRef.current, vRef.current);
  const expectedPrimary = packRGBA(expectedRGB.r, expectedRGB.g, expectedRGB.b, a);
  if (primary !== expectedPrimary) {
    hRef.current = derivedH;
    sRef.current = derivedS;
    vRef.current = derivedV;
  }

  const h = hRef.current;
  const s = sRef.current;
  const v = vRef.current;

  // Force re-render when s=0 and only H changes: all hues map to the same
  // gray so the store value doesn't change and React won't re-render.
  const [, forceRerender] = useState(0);

  const apply = (newH: number, newS: number, newV: number, newA: number) => {
    hRef.current = newH;
    sRef.current = newS;
    vRef.current = newV;
    const rgb = hsvToRgb(newH, newS, newV);
    const newPrimary = packRGBA(rgb.r, rgb.g, rgb.b, newA);
    usePaletteStore.getState().setPrimaryColor(newPrimary);
    // If the primary didn't change (e.g. s=0, same gray), the store won't
    // trigger a re-render, so force one so the hue marker moves visually.
    if (newPrimary === primary) forceRerender((n) => n + 1);
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
    apply((x / rect.width) * 360, s, v, a);
  });
  const alphaDrag = makeDragHandler((x, _y, rect) => {
    apply(h, s, v, Math.round((x / rect.width) * 255));
  });

  // ── Render ───────────────────────────────────────────────────────────────

  const hueOnly = hsvToRgb(h, 100, 100);
  const hueRgb = `rgb(${hueOnly.r}, ${hueOnly.g}, ${hueOnly.b})`;
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
        style={{ '--alpha-grad-end': opaqueHex } as React.CSSProperties}
      >
        <div className={styles.alphaMarker} style={{ left: `${(a / 255) * 100}%` }} />
      </div>

      <div className={styles.numberRow}>
        <Field label="H">
          <NumberInput
            value={Math.round(h)}
            step={1}
            aria-label="Hue"
            onChange={(nv) => {
              const wrapped = ((Math.round(nv) % 360) + 360) % 360;
              apply(wrapped, s, v, a);
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
