import { useEffect, useRef } from 'react';
import { CanvasEmptyState } from './CanvasEmptyState';
import {
  LuPencil, LuEraser, LuMinus, LuPipette,
  LuSquare, LuCircle, LuPaintBucket, LuMove, LuSquareDashed,
} from 'react-icons/lu';
import { useProjectStore } from '../../state/useProjectStore';
import { useLayerStore } from '../../state/useLayerStore';
import { useFrameStore } from '../../state/useFrameStore';
import { useUIStore } from '../../state/useUIStore';
import { useToolStore } from '../../state/useToolStore';
import { initEngine, getEngine, disposeEngine, DirtyFlag, setOnionFrames } from '../../state/renderBridge';
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
import { drawActions } from '../../state/action-composers';
import { useViewportInteraction } from './useViewportInteraction';
import styles from './CanvasViewport.module.css';

export function CanvasViewport(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);

  const { canvas } = useProjectStore();
  const { layers, activeLayerId } = useLayerStore();
  const { frames, activeFrameIndex } = useFrameStore();
  const { zoomLevel, panOffset, showGrid, showCheckerboard, cursorPosition, onionSkin } = useUIStore();
  const activeTool = useToolStore((s) => s.activeTool);
  const selection = useToolStore((s) => s.selection);
  const activeLayerLocked =
    layers.find((l) => l.id === activeLayerId)?.locked === true;

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

  // Push onion skin frames whenever frame index, layers, or onion settings change
  useEffect(() => {
    if (!onionSkin.enabled) {
      setOnionFrames([], [], onionSkin.opacity);
      return;
    }
    const prevFrames: (Uint8ClampedArray | null)[] = [];
    const nextFrames: (Uint8ClampedArray | null)[] = [];

    const cw = canvas.width;
    const ch = canvas.height;

    // CPU-composite a single frame index into one RGBA buffer by alpha-over blending
    const compositeFrame = (frameIdx: number): Uint8ClampedArray | null => {
      if (frameIdx < 0 || frameIdx >= frames.length) return null;
      const out = new Uint8ClampedArray(cw * ch * 4);
      for (const layer of [...layers].reverse()) {
        if (!layer.visible) continue;
        const data = resolveCell(frames, frameIdx, layer.id);
        if (!data) continue;
        const alpha = layer.opacity;
        for (let p = 0; p < cw * ch; p++) {
          const i = p * 4;
          const sa = (data[i + 3]! / 255) * alpha;
          const da = out[i + 3]! / 255;
          const oa = sa + da * (1 - sa);
          if (oa === 0) continue;
          out[i]     = Math.round(((data[i]!     / 255) * sa + (out[i]!     / 255) * da * (1 - sa)) / oa * 255);
          out[i + 1] = Math.round(((data[i + 1]! / 255) * sa + (out[i + 1]! / 255) * da * (1 - sa)) / oa * 255);
          out[i + 2] = Math.round(((data[i + 2]! / 255) * sa + (out[i + 2]! / 255) * da * (1 - sa)) / oa * 255);
          out[i + 3] = Math.round(oa * 255);
        }
      }
      return out;
    };

    for (let i = 1; i <= onionSkin.before; i++) {
      prevFrames.push(compositeFrame(activeFrameIndex - i));
    }
    for (let i = 1; i <= onionSkin.after; i++) {
      nextFrames.push(compositeFrame(activeFrameIndex + i));
    }
    setOnionFrames(prevFrames, nextFrames, onionSkin.opacity);
    getEngine()?.markDirty(DirtyFlag.OVERLAY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onionSkin, frames, activeFrameIndex]);

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

  // Push active tool changes to the engine
  useEffect(() => {
    setActiveTool(activeTool);
  }, [activeTool]);

  // Global keyboard shortcuts for tool switching
  useEffect(() => {
    const TOOL_KEYS: Record<string, string> = {
      b: 'pencil', e: 'eraser', l: 'line',
      r: 'rectangle', o: 'ellipse', g: 'fill',
      v: 'move', m: 'marquee',
      i: 'eyedropper', h: 'hand', z: 'zoom',
    };
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (ev.key === 'Escape') { useToolStore.getState().clearSelection(); return; }
      // Ctrl+I — invert active selection
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'i') {
        ev.preventDefault();
        useToolStore.getState().invertSelection();
        return;
      }
      // Delete / Backspace — erase selected pixels when a selection is active
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && useToolStore.getState().selection) {
        ev.preventDefault();
        drawActions.eraseSelection();
        return;
      }
      // Alt+Backspace — fill selection with primary colour
      if (ev.altKey && ev.key === 'Backspace' && useToolStore.getState().selection) {
        ev.preventDefault();
        drawActions.fillSelection();
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const tool = TOOL_KEYS[ev.key.toLowerCase()];
      if (tool) {
        useToolStore.getState().setActiveTool(tool as ReturnType<typeof useToolStore.getState>['activeTool']);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cursor — depends on active tool AND whether the active layer is locked.
  // Brush-style tools show 'not-allowed' over a locked layer to signal that
  // clicks won't paint. Marquee shows 'grab' when hovering inside a committed selection.
  useEffect(() => {
    const DRAW_TOOLS = new Set(['pencil', 'eraser', 'line', 'rectangle', 'ellipse', 'fill', 'move', 'marquee', 'eyedropper']);
    const baseCursor: Record<string, string> = {
      pencil: 'none', eraser: 'none', line: 'none',
      rectangle: 'none', ellipse: 'none', fill: 'none', marquee: 'crosshair',
      eyedropper: 'none',
      move: 'move',
      hand: 'grab',
      zoom: 'zoom-in',
    };
    const blockedByLock = activeLayerLocked && DRAW_TOOLS.has(activeTool);
    let cursor = blockedByLock ? 'not-allowed' : (baseCursor[activeTool] ?? 'default');

    if (!blockedByLock && activeTool === 'marquee' && selection && selection.data.length > 1 && cursorPosition) {
      const { bounds, data, width } = selection;
      const { x, y } = cursorPosition;
      const inBounds = x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
      if (inBounds && data[y * width + x] === 1) cursor = 'grab';
    }

    if (containerRef.current) {
      containerRef.current.style.cursor = cursor;
    }
  }, [activeTool, activeLayerLocked, selection, cursorPosition]);

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
      // Show grabbing cursor while dragging inside a committed marquee selection
      if (el.style.cursor === 'grab') el.style.cursor = 'grabbing';
      toolPointerDown(toInput(e));
    };
    const onMove = (e: PointerEvent) => {
      if (!drawing) return;
      toolPointerMove(toInput(e));
    };
    const onUp = (e: PointerEvent) => {
      if (!drawing) return;
      drawing = false;
      if (el.style.cursor === 'grabbing') el.style.cursor = 'grab';
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

  // Pixel crosshair — shown for drawing tools so the user can see which pixel
  // will be affected before clicking. Move uses the OS 'move' cursor instead.
  const CROSSHAIR_TOOLS = new Set([
    'pencil', 'eraser', 'line', 'rectangle', 'ellipse', 'fill', 'eyedropper',
  ]);
  // move and marquee get the icon overlay but not the pixel-box crosshair
  const showCrosshair = CROSSHAIR_TOOLS.has(activeTool) && cursorPosition != null;
  const showIconOnly  = (activeTool === 'move' || activeTool === 'marquee') && cursorPosition != null;

  // Small tool icon rendered next to the crosshair so the active tool is
  // always visible near the cursor without requiring a glance at the toolbar.
  const TOOL_ICON: Record<string, React.ReactNode> = {
    pencil:    <LuPencil size={14} />,
    eraser:    <LuEraser size={14} />,
    line:      <LuMinus size={14} />,
    rectangle: <LuSquare size={14} />,
    ellipse:   <LuCircle size={14} />,
    fill:      <LuPaintBucket size={14} />,
    move:      <LuMove size={14} />,
    marquee:   <LuSquareDashed size={14} />,
    eyedropper:<LuPipette size={14} />,
  };

  // Viewport chrome values
  const zoomLabel = `${zoomLevel * 100}%`;
  const cursorLabel =
    cursorPosition != null ? `${cursorPosition.x}, ${cursorPosition.y}` : '—';

  return (
    <div
      ref={containerRef}
      className={styles.viewport}
      tabIndex={0}
      onDoubleClick={() => {
        const sel = useToolStore.getState().selection;
        if (!sel) return;
        // Only clear when the double-click lands OUTSIDE the selection so a fast
        // drag-start inside the selection is never misread as a dismiss gesture.
        const cp = useUIStore.getState().cursorPosition;
        if (cp) {
          const { bounds, data, width } = sel;
          const inBounds = cp.x >= bounds.x && cp.x < bounds.x + bounds.w &&
                           cp.y >= bounds.y && cp.y < bounds.y + bounds.h;
          if (inBounds && data[cp.y * width + cp.x] === 1) return;
        }
        useToolStore.getState().clearSelection();
      }}
    >
      <canvas ref={glCanvasRef} className={styles.glCanvas} />
      {layers.length === 0 && <CanvasEmptyState />}
      {(showCrosshair || showIconOnly) && cursorPosition != null && (
        <>
          {showCrosshair && (
            <div
              className={styles.pixelCrosshair}
              style={{
                left: cursorPosition.x * zoomLevel + panOffset.x,
                top: cursorPosition.y * zoomLevel + panOffset.y,
                width: Math.max(zoomLevel, 2),
                height: Math.max(zoomLevel, 2),
              }}
            />
          )}
          {TOOL_ICON[activeTool] && (
            <div
              className={styles.toolCursorIcon}
              style={{
                left: cursorPosition.x * zoomLevel + panOffset.x + Math.max(zoomLevel, 2) + 3,
                top: cursorPosition.y * zoomLevel + panOffset.y + Math.max(zoomLevel, 2) + 1,
              }}
            >
              {TOOL_ICON[activeTool]}
            </div>
          )}
        </>
      )}
      {selection && (() => {
        const sx = selection.bounds.x * zoomLevel + panOffset.x;
        const sy = selection.bounds.y * zoomLevel + panOffset.y;
        const sw = selection.bounds.w * zoomLevel;
        const sh = selection.bounds.h * zoomLevel;
        // Inverted selection uses amber/orange ants to signal "drawing outside"
        const antColor = selection.inverted ? 'rgba(255,180,0,0.95)' : 'rgba(255,255,255,0.9)';
        return (
          <svg
            className={styles.selectionOverlay}
            style={{ left: sx, top: sy, width: sw, height: sh }}
            viewBox={`0 0 ${sw} ${sh}`}
          >
            <rect x={0.5} y={0.5} width={sw - 1} height={sh - 1}
              fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={1}
              strokeDasharray="4 4"
            />
            <rect x={0.5} y={0.5} width={sw - 1} height={sh - 1}
              fill="none" stroke={antColor} strokeWidth={1}
              strokeDasharray="4 4" strokeDashoffset="4"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="8"
                dur="0.4s" repeatCount="indefinite" />
            </rect>
          </svg>
        );
      })()}
      <div className={styles.chrome}>
        <span className={styles.chromeItem}>{zoomLabel}</span>
        <span className={styles.chromeItem}>{cursorLabel}</span>
      </div>
    </div>
  );
}
