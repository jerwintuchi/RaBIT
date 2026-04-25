import { useEffect, useRef } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { useLayerStore } from '../../state/useLayerStore';
import { useFrameStore } from '../../state/useFrameStore';
import { useUIStore } from '../../state/useUIStore';
import { useToolStore } from '../../state/useToolStore';
import { initEngine, getEngine, disposeEngine, DirtyFlag } from '../../state/renderBridge';
import type { RenderLayerSpec } from '../../state/renderBridge';
import {
  initToolEngine,
  disposeToolEngine,
  setToolTransform,
  setActiveTool,
  toolPointerDown,
  toolPointerMove,
  toolPointerUp,
} from '../../state/toolBridge';
import { resolveCell } from '../../state/action-composers/frame-utils';
import { useViewportInteraction } from './useViewportInteraction';
import styles from './CanvasViewport.module.css';

export function CanvasViewport(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);

  const { canvas } = useProjectStore();
  const { layers } = useLayerStore();
  const { frames, activeFrameIndex } = useFrameStore();
  const { zoomLevel, panOffset, showGrid, showCheckerboard, cursorPosition } = useUIStore();
  const activeTool = useToolStore((s) => s.activeTool);

  // Pan/zoom interaction — also returns a ref that's true while pan is claiming input
  const { inputClaimedRef } = useViewportInteraction(containerRef, canvas.width, canvas.height);

  // Initialize/destroy WebGL + Tool engines
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;
    const engine = initEngine(glCanvas);
    engine.setCanvasSize(canvas.width, canvas.height);
    engine.start();
    initToolEngine();
    return () => {
      disposeEngine();
      disposeToolEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize on container changes
  useEffect(() => {
    const container = containerRef.current;
    const glCanvas = glCanvasRef.current;
    if (!container || !glCanvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      glCanvas.width = w;
      glCanvas.height = h;
      getEngine()?.resize(w, h);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Push canvas size
  useEffect(() => {
    getEngine()?.setCanvasSize(canvas.width, canvas.height);
    getEngine()?.markDirty(DirtyFlag.FULL);
  }, [canvas.width, canvas.height]);

  // Push layer specs
  useEffect(() => {
    const specs: RenderLayerSpec[] = layers.map((l) => ({
      id: l.id,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
    }));
    getEngine()?.setLayers(specs);
    getEngine()?.markDirty(DirtyFlag.LAYER_ORDER);
  }, [layers]);

  // Push pixel data
  useEffect(() => {
    const engine = getEngine();
    if (!engine) return;
    for (const layer of layers) {
      const data = resolveCell(frames, activeFrameIndex, layer.id);
      if (data) engine.uploadLayerData(layer.id, data);
    }
    engine.markDirty(DirtyFlag.LAYER_DATA);
  }, [layers, frames, activeFrameIndex]);

  // Push view transform to both render + tool engines
  useEffect(() => {
    getEngine()?.setTransform(panOffset.x, panOffset.y, zoomLevel);
    getEngine()?.markDirty(DirtyFlag.OVERLAY);
    setToolTransform(panOffset.x, panOffset.y, zoomLevel);
  }, [panOffset.x, panOffset.y, zoomLevel]);

  // Push overlay toggles
  useEffect(() => {
    getEngine()?.setShowGrid(showGrid);
  }, [showGrid]);

  useEffect(() => {
    getEngine()?.setShowCheckerboard(showCheckerboard);
  }, [showCheckerboard]);

  // Push active tool changes (engine + cursor)
  useEffect(() => {
    setActiveTool(activeTool);
    const cursorMap: Record<string, string> = {
      pencil: 'crosshair',
      eraser: 'crosshair',
      line: 'crosshair',
      eyedropper: 'crosshair',
      hand: 'grab',
      zoom: 'zoom-in',
    };
    if (containerRef.current) {
      containerRef.current.style.cursor = cursorMap[activeTool] ?? 'default';
    }
  }, [activeTool]);

  // Tool pointer event routing — runs in addition to useViewportInteraction's pan handlers
  useEffect(() => {
    const el = containerRef.current;
    const glCanvas = glCanvasRef.current;
    if (!el || !glCanvas) return;

    let drawing = false;

    const toInput = (e: PointerEvent) => {
      const rect = glCanvas.getBoundingClientRect();
      return {
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        pressure: e.pressure || 1.0,
        button: e.button as 0 | 1 | 2,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
      };
    };

    const onDown = (e: PointerEvent) => {
      if (inputClaimedRef.current) return;
      if (e.button !== 0) return;
      drawing = true;
      el.setPointerCapture(e.pointerId);
      toolPointerDown(toInput(e));
    };
    const onMove = (e: PointerEvent) => {
      if (!drawing) return;
      toolPointerMove(toInput(e));
    };
    const onUp = (e: PointerEvent) => {
      if (!drawing) return;
      drawing = false;
      toolPointerUp(toInput(e));
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be released by the pan handler
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [inputClaimedRef]);

  // Viewport chrome values
  const zoomLabel = `${zoomLevel * 100}%`;
  const cursorLabel =
    cursorPosition != null ? `${cursorPosition.x}, ${cursorPosition.y}` : '—';

  return (
    <div ref={containerRef} className={styles.viewport} tabIndex={0}>
      <canvas ref={glCanvasRef} className={styles.glCanvas} />
      <div className={styles.chrome}>
        <span className={styles.chromeItem}>{zoomLabel}</span>
        <span className={styles.chromeItem}>{cursorLabel}</span>
      </div>
    </div>
  );
}
