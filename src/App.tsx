import { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { CanvasViewport } from './ui/canvas';
import { ToolBar } from './ui/toolbar';
import { LayerPanel, ColorPickerPanel, PalettePanel } from './ui/panels';
import { seedTestFixture, seedPerfFixture } from './ui/canvas/testFixture';
import { useLayerStore } from './state/useLayerStore';
import { useHistoryStore } from './state/useHistoryStore';
import { useToolStore } from './state/useToolStore';
import { usePaletteStore } from './state/usePaletteStore';
import { getEngine } from './state/renderBridge';

const DEV_HASH = '#/dev/components';
const PERF_HASH = '#/test/perf4k';

const DevHarness = lazy(() => import('./ui/dev/DevHarness').then((m) => ({ default: m.DevHarness })));

// Single-key tool shortcuts
const TOOL_SHORTCUTS: Record<string, Parameters<ReturnType<typeof useToolStore.getState>['setActiveTool']>[0]> = {
  b: 'pencil',
  e: 'eraser',
  l: 'line',
  i: 'eyedropper',
  h: 'hand',
  z: 'zoom',
};

// Expose test helpers to Playwright via window in dev/test mode
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>)['__rabitTest'] = {
    getEngine,
    getLayerStore: () => useLayerStore.getState(),
  };
}

export function App(): JSX.Element {
  const [showDev, setShowDev] = useState(() => window.location.hash === DEV_HASH);
  const [showPerf, setShowPerf] = useState(() => window.location.hash === PERF_HASH);

  useEffect(() => {
    const handler = () => {
      setShowDev(window.location.hash === DEV_HASH);
      setShowPerf(window.location.hash === PERF_HASH);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // Seed test fixture if no project is loaded yet
  const hasLayers = useLayerStore((s) => s.layers.length > 0);
  useLayoutEffect(() => {
    if (hasLayers || showDev) return;
    if (showPerf) {
      seedPerfFixture();
    } else {
      seedTestFixture();
    }
  }, [hasLayers, showDev, showPerf]);

  // Global keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo), tool keys
  useEffect(() => {
    if (showDev) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }
      // Single-key tool / color shortcuts (no modifier)
      if (!ctrl && !e.altKey && !e.shiftKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          useToolStore.getState().setActiveTool(tool);
          return;
        }
        if (e.key.toLowerCase() === 'x') {
          e.preventDefault();
          usePaletteStore.getState().swapColors();
          return;
        }
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          usePaletteStore.getState().resetColors();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDev]);

  if (import.meta.env.DEV && showDev) {
    return (
      <Suspense fallback={null}>
        <DevHarness />
      </Suspense>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr 240px',
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-0)',
        overflow: 'hidden',
      }}
    >
      <ToolBar />
      <CanvasViewport />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <ColorPickerPanel />
        <div style={{ maxHeight: '40%', display: 'flex', minHeight: 0 }}>
          <PalettePanel />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <LayerPanel />
        </div>
      </div>
    </div>
  );
}
