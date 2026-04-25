import { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { CanvasViewport } from './ui/canvas';
import { ToolBar } from './ui/toolbar';
import { seedTestFixture } from './ui/canvas/testFixture';
import { useLayerStore } from './state/useLayerStore';
import { useHistoryStore } from './state/useHistoryStore';
import { useToolStore } from './state/useToolStore';

const DEV_HASH = '#/dev/components';

const DevHarness = lazy(() => import('./ui/dev/DevHarness').then((m) => ({ default: m.DevHarness })));

// Single-key tool shortcuts (M4: pencil only)
const TOOL_SHORTCUTS: Record<string, Parameters<ReturnType<typeof useToolStore.getState>['setActiveTool']>[0]> = {
  b: 'pencil',
};

export function App(): JSX.Element {
  const [showDev, setShowDev] = useState(() => window.location.hash === DEV_HASH);

  useEffect(() => {
    const handler = () => setShowDev(window.location.hash === DEV_HASH);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // Seed test fixture if no project is loaded yet
  const hasLayers = useLayerStore((s) => s.layers.length > 0);
  useLayoutEffect(() => {
    if (!hasLayers && !showDev) {
      seedTestFixture();
    }
  }, [hasLayers, showDev]);

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
      // Single-key tool shortcuts (no modifier)
      if (!ctrl && !e.altKey && !e.shiftKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          useToolStore.getState().setActiveTool(tool);
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
        gridTemplateColumns: '48px 1fr',
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-0)',
        overflow: 'hidden',
      }}
    >
      <ToolBar />
      <CanvasViewport />
    </div>
  );
}
