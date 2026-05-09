import { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CanvasViewport } from './ui/canvas';
import { ToolBar } from './ui/toolbar';
import { LayerPanel, ColorPickerPanel, PalettePanel, Timeline } from './ui/panels';
import { seedPerfFixture } from './ui/canvas/testFixture';
import { frameActions, fileActions } from './state/action-composers';
import { useLayerStore } from './state/useLayerStore';
import { useHistoryStore } from './state/useHistoryStore';
import { useToolStore } from './state/useToolStore';
import { usePaletteStore } from './state/usePaletteStore';
import { useUIStore } from './state/useUIStore';
import { usePrefsStore } from './state/usePrefsStore';
import { getEngine } from './state/renderBridge';
import { ipcGetRecentFiles, listenAutoSaveRequest } from './bridge/projectIpc';
import { ipcPrefsLoad } from './bridge/prefsIpc';
import { startFileWatchListener } from './bridge/fileWatchListener';
import { ToastContainer } from './ui/primitives/Toast';
import { SaveBadge } from './ui/primitives/SaveBadge';
import { UnsavedChangesDialog, ExternalChangeDialog, NewProjectDialog, ResizeCanvasDialog, CrashRecoveryDialog, ExportDialog, PrefsDialog } from './ui/dialogs';
import { WelcomeScreen } from './ui/screens';
import { MenuBar } from './ui/menu';

const DEV_HASH = '#/dev/components';
const PERF_HASH = '#/test/perf4k';

const DevHarness = lazy(() => import('./ui/dev/DevHarness').then((m) => ({ default: m.DevHarness })));

// Maps action IDs for single-key tool shortcuts to ToolId
const ACTION_TO_TOOL: Record<string, Parameters<ReturnType<typeof useToolStore.getState>['setActiveTool']>[0]> = {
  'tool.pencil':     'pencil',
  'tool.eraser':     'eraser',
  'tool.line':       'line',
  'tool.eyedropper': 'eyedropper',
  'tool.hand':       'hand',
  'tool.zoom':       'zoom',
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
  const welcomeVisible = useUIStore((s) => s.welcomeScreen.visible);

  useEffect(() => {
    const handler = () => {
      setShowDev(window.location.hash === DEV_HASH);
      setShowPerf(window.location.hash === PERF_HASH);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // ── Cold start: show welcome screen or seed test fixtures ─────────────────
  const hasLayers = useLayerStore((s) => s.layers.length > 0);
  useLayoutEffect(() => {
    if (hasLayers || showDev) return;
    if (showPerf) {
      seedPerfFixture();
      return;
    }
    // Normal cold start — show welcome screen and load recent files
    useUIStore.getState().setWelcomeVisible(true);
    ipcGetRecentFiles()
      .then((files) => useUIStore.getState().setRecentFiles(files))
      .catch(() => null);
  }, [hasLayers, showDev, showPerf]);

  // ── Preferences hydration (once on mount) ────────────────────────────────
  useEffect(() => {
    ipcPrefsLoad()
      .then(({ prefs, was_corrupt }) => {
        usePrefsStore.getState().hydrate(prefs);
        if (was_corrupt) {
          useUIStore.getState().addToast('Preferences file was corrupt — reset to defaults.', 'warning');
        }
      })
      .catch(() => null);
  }, []);

  // ── Dirty subscriptions (content changes → mark project dirty) ─────────────
  useEffect(() => {
    fileActions.startDirtySubscriptions();
  }, []);

  // ── Crash recovery check (once on mount) ──────────────────────────────────
  useEffect(() => {
    if (showDev || showPerf) return;
    void fileActions.checkCrashRecovery();
  }, [showDev, showPerf]);

  // ── Auto-save listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (showDev || showPerf) return;
    let unlisten: (() => void) | null = null;
    listenAutoSaveRequest(() => {
      // Skip if no project is open or a stroke is in progress
      const hasProject = useLayerStore.getState().layers.length > 0;
      if (!hasProject) return;
      void fileActions.writeAutoSave();
    }).then((fn) => { unlisten = fn; }).catch(() => null);
    return () => { unlisten?.(); };
  }, [showDev, showPerf]);

  // ── File watch listener (external file change) ────────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    startFileWatchListener((event) => {
      // Suppress if we just saved (within 2 seconds) to avoid false positives on Windows
      void event;
      const savedAt = (window as unknown as Record<string, unknown>)['__rabitSavedAt'] as number | undefined;
      if (savedAt && Date.now() - savedAt < 2000) return;
      useUIStore.getState().showExternalChangeDialog(event.path);
    }).then((fn) => { unlisten = fn; }).catch(() => null);
    return () => { unlisten?.(); };
  }, []);

  // ── Window close interception ─────────────────────────────────────────────
  useEffect(() => {
    if (showDev) return;
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault();
        await fileActions.handleCloseRequest();
      })
      .then((fn) => { unlisten = fn; })
      .catch(() => null);
    return () => { unlisten?.(); };
  }, [showDev]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    if (showDev) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // File operations
      if (ctrl && e.key.toLowerCase() === 'n' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        useUIStore.getState().showNewProjectDialog();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileActions.openProject();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        fileActions.saveProject();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        fileActions.saveProjectAs();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (useLayerStore.getState().layers.length > 0) useUIStore.getState().showExportDialog();
        return;
      }
      if (ctrl && e.key === ',') {
        e.preventDefault();
        useUIStore.getState().showPrefsDialog();
        return;
      }

      // Undo / Redo
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

      // Frame shortcuts
      if (ctrl && e.altKey) {
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); frameActions.addFrame(); return; }
        if (e.key.toLowerCase() === 'd') { e.preventDefault(); frameActions.duplicateActiveFrame(); return; }
      }

      // Single-key tool / color shortcuts (no modifier) — from user keybindings
      if (!ctrl && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        const kb = usePrefsStore.getState().keybindings;
        for (const [actionId, bound] of Object.entries(kb)) {
          if (bound.toLowerCase() === key) {
            e.preventDefault();
            const toolId = ACTION_TO_TOOL[actionId];
            if (toolId) { useToolStore.getState().setActiveTool(toolId); return; }
            if (actionId === 'color.swap') { usePaletteStore.getState().swapColors(); return; }
            if (actionId === 'color.reset') { usePaletteStore.getState().resetColors(); return; }
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDev]);

  // ── Dev harness ───────────────────────────────────────────────────────────
  if (import.meta.env.DEV && showDev) {
    return (
      <Suspense fallback={null}>
        <DevHarness />
      </Suspense>
    );
  }

  // ── Welcome screen ────────────────────────────────────────────────────────
  if (welcomeVisible) {
    return (
      <>
        <WelcomeScreen />
        <CrashRecoveryDialog />
        <ToastContainer />
      </>
    );
  }

  // ── Editor layout ─────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '48px 1fr 240px',
          gridTemplateRows: 'auto 1fr 240px',
          width: '100vw',
          height: '100vh',
          background: 'var(--bg-0)',
          overflow: 'hidden',
        }}
      >
        {/* Menu bar — row 1, spans all columns */}
        <div style={{ gridColumn: '1 / 4', gridRow: '1' }}>
          <MenuBar />
        </div>

        {/* Left toolbar — rows 2–3 */}
        <div style={{ gridRow: '2 / 4', display: 'flex', flexDirection: 'column' }}>
          <ToolBar />
        </div>

        {/* Canvas viewport — row 2, col 2 */}
        <CanvasViewport />

        {/* Right panel — row 2, col 3 */}
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

        {/* Timeline — row 3, spans cols 2–3 */}
        <div style={{ gridColumn: '2 / 4', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <Timeline />
        </div>
      </div>

      {/* Global overlays — outside the grid */}
      <UnsavedChangesDialog />
      <ExternalChangeDialog />
      <NewProjectDialog />
      <ResizeCanvasDialog />
      <CrashRecoveryDialog />
      <ExportDialog />
      <PrefsDialog />
      <SaveBadge />
      <ToastContainer />
    </>
  );
}
