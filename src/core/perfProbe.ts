/**
 * Lightweight opt-in performance probe.
 * Enable via DevTools console: window.__rabitPerf = true
 * Results accumulate in window.__rabitPerfResults and are logged every 20 samples.
 */

declare global {
  interface Window {
    __rabitPerf?: boolean;
    __rabitPerfResults?: number[];
  }
}

let _t0 = 0;

export function perfMark(): void {
  if (!window.__rabitPerf) return;
  _t0 = performance.now();
}

export function perfMeasure(label: string): void {
  if (!window.__rabitPerf || _t0 === 0) return;
  const ms = performance.now() - _t0;
  _t0 = 0;

  if (!window.__rabitPerfResults) window.__rabitPerfResults = [];
  window.__rabitPerfResults.push(ms);

  const r = window.__rabitPerfResults;
  if (r.length % 20 === 0) {
    const sorted = [...r].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)]!.toFixed(2);
    const p99 = sorted[Math.floor(sorted.length * 0.99)]!.toFixed(2);
    const avg = (r.reduce((a, b) => a + b, 0) / r.length).toFixed(2);
    console.log(`[RaBIT perf] ${label} — n=${r.length}  avg=${avg}ms  p50=${p50}ms  p99=${p99}ms`);
  }
}
