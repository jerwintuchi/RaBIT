import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  LuPlay, LuPause, LuSkipBack, LuSkipForward,
  LuChevronLeft, LuChevronRight, LuPlus, LuLink, LuX, LuCopy,
} from 'react-icons/lu';
import { useFrameStore } from '../../../state/useFrameStore';
import { useLayerStore } from '../../../state/useLayerStore';
import { useUIStore } from '../../../state/useUIStore';
import {
  goToFrame,
  goToFirstFrame,
  goToLastFrame,
  goToNextFrame,
  goToPrevFrame,
  frameActions,
  layerActions,
  tagActions,
} from '../../../state/action-composers';
import { IconLock } from '../../../assets/icons';
import { ContextMenu } from '../../primitives';
import type { ContextMenuItem } from '../../primitives';
import { resolveCell } from '../../../state/action-composers/frame-utils';
import styles from './Timeline.module.css';

const FRAME_COL_W = 76; // px — must match .frameHeader width in CSS
const THUMB_SIZE = 60;

/** Render a single layer's pixels for a frame into a tiny canvas and return a data-URL. */
function computeThumb(frameIndex: number, layerId: string): string | null {
  const { frames } = useFrameStore.getState();
  const frame = frames[frameIndex];
  if (!frame) return null;

  const data = resolveCell(frames, frameIndex, layerId);
  if (!data) return null;

  const side = Math.round(Math.sqrt(data.length / 4));
  const cw = side, ch = side;
  if (!cw || !ch) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = cw; offscreen.height = ch;
  const octx = offscreen.getContext('2d');
  if (!octx) return null;
  octx.putImageData(new ImageData(new Uint8ClampedArray(data), cw, ch), 0, 0);

  const out = document.createElement('canvas');
  out.width = THUMB_SIZE; out.height = THUMB_SIZE;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(offscreen, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return out.toDataURL();
}

function ThumbCell({ frameIndex, layerId }: { frameIndex: number; layerId: string }): JSX.Element {
  const dataVersion = useLayerStore((s) => s.dataVersions[layerId] ?? 0);
  const src = useMemo(
    () => computeThumb(frameIndex, layerId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameIndex, layerId, dataVersion],
  );
  if (!src) return <div className={styles.frameCellEmpty} />;
  return <img src={src} className={styles.frameCellThumb} alt="" />;
}

function FrameCell({
  frameIndex, layerId, isActive, isSelected, isDragSource,
}: {
  frameIndex: number; layerId: string; isActive: boolean;
  isSelected: boolean; isDragSource: boolean;
}): JSX.Element {
  const frames = useFrameStore((s) => s.frames);
  const frame = frames[frameIndex];
  const cell = frame?.cells[layerId];

  const cls = [
    styles.frameCell,
    isActive ? styles.activeCol : '',
    isSelected && !isActive ? styles.selectedCol : '',
    isDragSource ? styles.draggingCol : '',
  ].filter(Boolean).join(' ');

  if (!frame) return <div className={cls} />;
  if (cell?.linked) {
    return (
      <div className={cls} title="Linked cell">
        <LuLink size={10} className={styles.frameCellLinked} />
      </div>
    );
  }
  const hasContent = cell?.data && cell.data.some((b) => b !== 0);
  if (!hasContent) {
    return (
      <div className={cls} title="Empty cell">
        <div className={styles.frameCellEmpty} />
      </div>
    );
  }
  return (
    <div className={cls} title={`Frame ${frameIndex + 1}`}>
      <ThumbCell frameIndex={frameIndex} layerId={layerId} />
    </div>
  );
}

function executeDuplicate(sel: ReadonlySet<number>): void {
  const { activeFrameIndex: afi } = useFrameStore.getState();
  if (sel.size > 1) {
    frameActions.duplicateFramesAfterLast([...sel]);
  } else {
    frameActions.duplicateFrameAtIndex(sel.size === 1 ? [...sel][0]! : afi);
  }
}

export function Timeline(): JSX.Element {
  const frames = useFrameStore((s) => s.frames);
  const activeFrameIndex = useFrameStore((s) => s.activeFrameIndex);
  const playback = useFrameStore((s) => s.playback);
  const setPlaying = useCallback((v: boolean) => useFrameStore.getState().setPlaying(v), []);
  const setFps = useCallback((v: number) => useFrameStore.getState().setFps(v), []);
  const setLoop = useCallback((v: boolean) => useFrameStore.getState().setLoop(v), []);

  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const onionSkin = useUIStore((s) => s.onionSkin);
  const setOnionSkin = useCallback((patch: Partial<{ enabled: boolean; before: number; after: number; color: number }>) => useUIStore.getState().setOnionSkin(patch), []);

  // ── Frame multi-select ──────────────────────────────────────────────────────
  const [selectedFrameIndices, setSelectedFrameIndices] = useState<Set<number>>(new Set());
  const selectedFrameIndicesRef = useRef(selectedFrameIndices);
  useEffect(() => { selectedFrameIndicesRef.current = selectedFrameIndices; }, [selectedFrameIndices]);

  const handleFrameSelect = useCallback((fi: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    if (e.shiftKey) {
      const af = useFrameStore.getState().activeFrameIndex;
      const lo = Math.min(af, fi);
      const hi = Math.max(af, fi);
      const range = new Set<number>();
      for (let i = lo; i <= hi; i++) range.add(i);
      setSelectedFrameIndices(range);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedFrameIndices((prev) => {
        const next = new Set(prev);
        if (next.has(fi)) next.delete(fi); else next.add(fi);
        return next;
      });
    } else {
      setSelectedFrameIndices(new Set());
      goToFrame(fi);
    }
  }, []);

  // ── Frame drag-to-reorder ───────────────────────────────────────────────────
  // Pointer handlers live on frameGridRef (the scrollable container) so the
  // user can start a drag from any cell — not just the header strip.
  const frameGridRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{
    active: boolean;
    isDragging: boolean;
    sourceFi: number;
    sourceIndices: number[];
    startX: number;
    pointerId: number;
    pendingClick: boolean;
    pendingClickEvent: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean } | null;
  }>({
    active: false, isDragging: false, sourceFi: -1,
    sourceIndices: [], startX: 0, pointerId: -1,
    pendingClick: false, pendingClickEvent: null,
  });

  const [dragVisual, setDragVisual] = useState<{
    sourceIndices: number[];
    dropSlot: number;
  } | null>(null);

  const getDropSlotFromClientX = useCallback((clientX: number): number => {
    const grid = frameGridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    const x = clientX - rect.left + grid.scrollLeft;
    return Math.max(0, Math.min(frames.length, Math.round(x / FRAME_COL_W)));
  }, [frames.length]);

  // Compute fi from clientX relative to the frame grid scroll area
  const getFiFromClientX = useCallback((clientX: number): number => {
    const grid = frameGridRef.current;
    if (!grid) return -1;
    const rect = grid.getBoundingClientRect();
    const x = clientX - rect.left + grid.scrollLeft;
    return Math.floor(x / FRAME_COL_W);
  }, []);

  const onGridPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const fi = getFiFromClientX(e.clientX);
    if (fi < 0 || fi >= frames.length) return;

    const selSet = selectedFrameIndicesRef.current;
    // If pointer is on an already-selected frame with multi-select, drag all selected
    const sourceIndices =
      (selSet.has(fi) && selSet.size > 1)
        ? [...selSet].sort((a, b) => a - b)
        : [fi];

    dragRef.current = {
      active: true, isDragging: false,
      sourceFi: fi, sourceIndices,
      startX: e.clientX, pointerId: e.pointerId,
      pendingClick: true,
      pendingClickEvent: { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [frames.length, getFiFromClientX]);

  const onGridPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current;
    if (!dr.active) return;
    const dx = Math.abs(e.clientX - dr.startX);
    if (!dr.isDragging && dx > 5) {
      dr.isDragging = true;
      dr.pendingClick = false;
      setDragVisual({ sourceIndices: dr.sourceIndices, dropSlot: dr.sourceFi });
    }
    if (dr.isDragging) {
      const slot = getDropSlotFromClientX(e.clientX);
      setDragVisual({ sourceIndices: dr.sourceIndices, dropSlot: slot });
    }
  }, [getDropSlotFromClientX]);

  const onGridPointerUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current;
    if (!dr.active) return;

    if (dr.isDragging && dragVisual !== null) {
      const { sourceIndices, dropSlot } = dragVisual;
      if (sourceIndices.length === 1) {
        const from = sourceIndices[0]!;
        const to = dropSlot <= from ? dropSlot : dropSlot - 1;
        if (to !== from) frameActions.reorderFrame(from, to);
      } else {
        frameActions.reorderMultipleFrames(sourceIndices, dropSlot);
      }
      // Keep selection visible after reorder so user sees what moved
      setSelectedFrameIndices(new Set(sourceIndices));
    } else if (dr.pendingClick && dr.pendingClickEvent) {
      const ev = dr.pendingClickEvent;
      const selSet = selectedFrameIndicesRef.current;
      // Clicking on an already-selected frame with no modifiers: just navigate,
      // don't clear the multi-selection — user may want to drag next.
      if (!ev.shiftKey && !ev.ctrlKey && !ev.metaKey && selSet.has(dr.sourceFi) && selSet.size > 1) {
        goToFrame(dr.sourceFi);
      } else {
        handleFrameSelect(dr.sourceFi, ev);
      }
    }

    dragRef.current = {
      active: false, isDragging: false, sourceFi: -1, sourceIndices: [],
      startX: 0, pointerId: -1, pendingClick: false, pendingClickEvent: null,
    };
    setDragVisual(null);
  }, [dragVisual, handleFrameSelect]);

  const onGridPointerCancel = useCallback(() => {
    dragRef.current = {
      active: false, isDragging: false, sourceFi: -1, sourceIndices: [],
      startX: 0, pointerId: -1, pendingClick: false, pendingClickEvent: null,
    };
    setDragVisual(null);
  }, []);

  // ── Duplicate helper ────────────────────────────────────────────────────────
  const duplicateSelected = useCallback(() => {
    executeDuplicate(selectedFrameIndices);
    setSelectedFrameIndices(new Set());
  }, [selectedFrameIndices]);

  // ── Playback ────────────────────────────────────────────────────────────────
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current !== null) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(() => {
    stopPlayback();
    const ms = Math.round(1000 / useFrameStore.getState().playback.fps);
    playIntervalRef.current = setInterval(() => {
      const { frames: fs, activeFrameIndex: idx, playback: pb } = useFrameStore.getState();
      const next = idx + 1;
      if (next >= fs.length) {
        if (pb.loop) { goToFrame(0); }
        else { stopPlayback(); useFrameStore.getState().setPlaying(false); }
      } else {
        goToFrame(next);
      }
    }, ms);
  }, [stopPlayback]);

  useEffect(() => {
    if (playback.playing) startPlayback();
    else stopPlayback();
    return stopPlayback;
  }, [playback.playing, playback.fps, startPlayback, stopPlayback]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === ',') { e.preventDefault(); goToPrevFrame(); return; }
      if (e.key === '.') { e.preventDefault(); goToNextFrame(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        useFrameStore.getState().setPlaying(!useFrameStore.getState().playback.playing);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const sel = selectedFrameIndicesRef.current;
        {
          executeDuplicate(sel);
        }
        setSelectedFrameIndices(new Set());
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { activeFrameIndex: afi, frames: fs } = useFrameStore.getState();
        const toDelete = selectedFrameIndicesRef.current.size > 0
          ? [...selectedFrameIndicesRef.current]
          : [afi];
        const sorted = [...new Set(toDelete)].sort((a, b) => b - a);
        if (sorted.length >= fs.length) sorted.pop();
        for (const fi of sorted) frameActions.removeFrameAtIndex(fi);
        setSelectedFrameIndices(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleFpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 1 && v <= 120) setFps(v);
  };

  const deleteFrame = (fi: number, e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    frameActions.removeFrameAtIndex(fi);
    setSelectedFrameIndices((prev) => {
      const next = new Set(prev);
      next.delete(fi);
      return next;
    });
  };

  const displayLayers = useMemo(() => [...layers].reverse(), [layers]);

  // ── Layer rename in timeline ────────────────────────────────────────────────
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renamingLayerName, setRenamingLayerName] = useState('');
  const [layerCtxMenu, setLayerCtxMenu] = useState<{ layerId: string; anchor: { x: number; y: number } } | null>(null);
  const layerRenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingLayerId && layerRenameInputRef.current) {
      layerRenameInputRef.current.focus();
      layerRenameInputRef.current.select();
    }
  }, [renamingLayerId]);

  const commitLayerRename = useCallback(() => {
    if (!renamingLayerId) return;
    layerActions.renameLayer(renamingLayerId, renamingLayerName);
    setRenamingLayerId(null);
  }, [renamingLayerId, renamingLayerName]);

  // Cancel any in-progress rename when the layer list changes (e.g. project reload)
  useEffect(() => {
    setRenamingLayerId(null);
  }, [layers]);

  // ── Tag row state ───────────────────────────────────────────────────────────
  const tags = useFrameStore((s) => s.tags);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const [tagDragStart, setTagDragStart] = useState<number | null>(null);
  const [tagDraftEnd, setTagDraftEnd] = useState<number | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [tagContextMenu, setTagContextMenu] = useState<{
    id: string;
    anchor: { x: number; y: number };
  } | null>(null);

  const fiFromTagRowX = useCallback((clientX: number): number => {
    const row = tagRowRef.current;
    if (!row) return 0;
    const rect = row.getBoundingClientRect();
    const scrollLeft = frameGridRef.current?.scrollLeft ?? 0;
    const x = clientX - rect.left + scrollLeft;
    return Math.max(0, Math.min(frames.length - 1, Math.floor(x / FRAME_COL_W)));
  }, [frames.length]);

  const onTagRowMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const fi = fiFromTagRowX(e.clientX);
    setTagDragStart(fi);
    setTagDraftEnd(fi);
  }, [fiFromTagRowX]);

  const onTagRowMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (tagDragStart === null) return;
    setTagDraftEnd(fiFromTagRowX(e.clientX));
  }, [tagDragStart, fiFromTagRowX]);

  const onTagRowMouseUp = useCallback(() => {
    if (tagDragStart !== null && tagDraftEnd !== null) {
      tagActions.createTag(tagDragStart, tagDraftEnd);
    }
    setTagDragStart(null);
    setTagDraftEnd(null);
  }, [tagDragStart, tagDraftEnd]);

  const commitTagRename = useCallback(() => {
    if (!editingTagId) return;
    tagActions.renameTag(editingTagId, editingTagName.trim() || 'Tag');
    setEditingTagId(null);
  }, [editingTagId, editingTagName]);

  return (
    <div className={styles.timeline}>
      {/* Controls row */}
      <div className={styles.controls}>
        <button type="button" className={styles.transportBtn} onClick={goToFirstFrame} title="First frame">
          <LuSkipBack size={14} />
        </button>
        <button type="button" className={styles.transportBtn} onClick={goToPrevFrame} title="Prev frame (,)">
          <LuChevronLeft size={14} />
        </button>
        <button
          type="button"
          className={`${styles.transportBtn}${playback.playing ? ' ' + styles.active : ''}`}
          onClick={() => setPlaying(!playback.playing)}
          title="Play / Pause (Enter)"
        >
          {playback.playing ? <LuPause size={14} /> : <LuPlay size={14} />}
        </button>
        <button type="button" className={styles.transportBtn} onClick={goToNextFrame} title="Next frame (.)">
          <LuChevronRight size={14} />
        </button>
        <button type="button" className={styles.transportBtn} onClick={goToLastFrame} title="Last frame">
          <LuSkipForward size={14} />
        </button>

        <div className={styles.separator} />

        <button type="button" className={styles.transportBtn} onClick={() => frameActions.addFrame()} title="Add frame after active">
          <LuPlus size={14} />
        </button>
        <button type="button" className={styles.transportBtn} onClick={duplicateSelected} title="Duplicate selected frame(s) (Ctrl+D)">
          <LuCopy size={14} />
        </button>

        <div className={styles.separator} />

        <span className={styles.fpsLabel}>FPS</span>
        <input
          className={styles.fpsInput}
          type="number"
          min={1}
          max={120}
          value={playback.fps}
          onChange={handleFpsChange}
        />

        <div className={styles.separator} />

        <label className={styles.loopLabel}>
          <input type="checkbox" checked={playback.loop} onChange={(e) => setLoop(e.target.checked)} />
          Loop
        </label>

        <div className={styles.separator} />

        <label className={styles.onionLabel}>
          <input type="checkbox" checked={onionSkin.enabled} onChange={(e) => setOnionSkin({ enabled: e.target.checked })} />
          Onion
        </label>
        {onionSkin.enabled && (
          <>
            <input
              className={styles.onionCount}
              type="number" min={0} max={5}
              value={onionSkin.before}
              onChange={(e) => setOnionSkin({ before: Math.min(5, Math.max(0, +e.target.value)) })}
              title="Frames before"
            />
            <span className={styles.fpsLabel}>/</span>
            <input
              className={styles.onionCount}
              type="number" min={0} max={5}
              value={onionSkin.after}
              onChange={(e) => setOnionSkin({ after: Math.min(5, Math.max(0, +e.target.value)) })}
              title="Frames after"
            />
          </>
        )}

        <span className={styles.frameCounter}>
          {activeFrameIndex + 1} / {frames.length}
        </span>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Layer label column */}
        <div className={styles.layerLabels}>
          <div className={styles.tagRowSpacer} />
          <div className={styles.layerLabelsHeader}><span>Layer</span></div>
          <div className={styles.layerLabelsList}>
            {displayLayers.map((layer) => (
              <div
                key={layer.id}
                className={[
                  styles.layerLabelRow,
                  layer.id === activeLayerId ? styles.activeLayer : '',
                ].filter(Boolean).join(' ')}
                onClick={() => useLayerStore.getState().setActiveLayer(layer.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  useLayerStore.getState().setActiveLayer(layer.id);
                  setLayerCtxMenu({ layerId: layer.id, anchor: { x: e.clientX, y: e.clientY } });
                }}
                title={`${layer.name} — click to select, right-click for options`}
              >
                <button
                  type="button"
                  className={[styles.layerLockBtn, layer.locked ? styles.locked : ''].filter(Boolean).join(' ')}
                  aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  aria-pressed={layer.locked}
                  onClick={(e) => { e.stopPropagation(); layerActions.setLayerLocked(layer.id, !layer.locked); }}
                >
                  <IconLock />
                </button>
                {renamingLayerId === layer.id ? (
                  <input
                    ref={layerRenameInputRef}
                    className={styles.layerRenameInput}
                    value={renamingLayerName}
                    onChange={(e) => setRenamingLayerName(e.target.value)}
                    onBlur={commitLayerRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitLayerRename(); }
                      if (e.key === 'Escape') setRenamingLayerId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={64}
                  />
                ) : (
                  <span>{layer.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Frame grid — pointer drag handled here so any cell can be dragged */}
        <div
          ref={frameGridRef}
          className={styles.frameGrid}
          onPointerDown={onGridPointerDown}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
          onPointerCancel={onGridPointerCancel}
        >
          {/* Tag row */}
          <div
            ref={tagRowRef}
            className={styles.tagRow}
            onMouseDown={onTagRowMouseDown}
            onMouseMove={onTagRowMouseMove}
            onMouseUp={onTagRowMouseUp}
            onMouseLeave={onTagRowMouseUp}
          >
            {tags.map((tag) => {
              const left = tag.from * FRAME_COL_W;
              const width = (tag.to - tag.from + 1) * FRAME_COL_W;
              const r = (tag.color >>> 24) & 0xff;
              const g = (tag.color >>> 16) & 0xff;
              const b = (tag.color >>> 8) & 0xff;
              const bg = `rgba(${r},${g},${b},0.25)`;
              const border = `rgb(${r},${g},${b})`;
              return (
                <div
                  key={tag.id}
                  className={styles.tagBand}
                  style={{ left, width, background: bg, borderColor: border }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => goToFrame(tag.from)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTagId(tag.id);
                    setEditingTagName(tag.name);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTagContextMenu({ id: tag.id, anchor: { x: e.clientX, y: e.clientY } });
                  }}
                >
                  {editingTagId === tag.id ? (
                    <input
                      className={styles.tagRenameInput}
                      autoFocus
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      onBlur={commitTagRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTagRename();
                        if (e.key === 'Escape') setEditingTagId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={styles.tagName}>{tag.name}</span>
                  )}
                </div>
              );
            })}

            {/* Draft band preview while dragging to create a tag */}
            {tagDragStart !== null && tagDraftEnd !== null && (
              <div
                className={styles.tagBandDraft}
                style={{
                  left: Math.min(tagDragStart, tagDraftEnd) * FRAME_COL_W,
                  width: (Math.abs(tagDraftEnd - tagDragStart) + 1) * FRAME_COL_W,
                }}
              />
            )}
          </div>

          {/* Frame headers strip */}
          <div className={styles.frameHeaders}>
            {frames.map((frame, fi) => {
              const isActive = fi === activeFrameIndex;
              const isSelected = selectedFrameIndices.has(fi);
              const isDragSrc = dragVisual?.sourceIndices.includes(fi) ?? false;
              return (
                <div
                  key={frame.id}
                  className={[
                    styles.frameHeader,
                    isActive ? styles.activeCol : '',
                    isSelected && !isActive ? styles.selectedCol : '',
                    isDragSrc ? styles.draggingCol : '',
                  ].filter(Boolean).join(' ')}
                  title={`Frame ${fi + 1} — click to select, Shift+click to range-select, Ctrl+click to toggle, drag to reorder`}
                >
                  <span className={styles.frameNum}>{fi + 1}</span>
                  <span className={styles.frameDur}>{frame.duration}ms</span>
                  {/* Duplicate button — top-left, visible on hover */}
                  <button
                    type="button"
                    className={styles.frameDupBtn}
                    title={`Duplicate frame ${fi + 1}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      frameActions.duplicateFrameAtIndex(fi);
                    }}
                  >
                    <LuCopy size={9} />
                  </button>
                  {/* Delete button — top-right, visible on hover */}
                  {frames.length > 1 && (
                    <button
                      type="button"
                      className={styles.frameDeleteBtn}
                      title={`Delete frame ${fi + 1}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => deleteFrame(fi, e)}
                    >
                      <LuX size={9} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add-frame placeholder cell — looks like an empty frame with a + */}
            <div
              className={styles.addFrameCell}
              title="Add new frame at end"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => frameActions.addFrameAtEnd()}
            >
              <LuPlus size={16} />
            </div>

            {/* Drop indicator line */}
            {dragVisual !== null && (
              <div
                className={styles.dropIndicator}
                style={{ left: dragVisual.dropSlot * FRAME_COL_W }}
              />
            )}
          </div>

          {/* Per-layer frame rows */}
          <div className={styles.frameRows}>
            {displayLayers.map((layer) => {
              const isActiveLayer = layer.id === activeLayerId;
              return (
                <div
                  key={layer.id}
                  className={[
                    styles.frameRow,
                    isActiveLayer ? styles.activeLayerRow : '',
                  ].filter(Boolean).join(' ')}
                >
                  {frames.map((frame, fi) => (
                    <FrameCell
                      key={frame.id}
                      frameIndex={fi}
                      layerId={layer.id}
                      isActive={fi === activeFrameIndex}
                      isSelected={selectedFrameIndices.has(fi)}
                      isDragSource={dragVisual?.sourceIndices.includes(fi) ?? false}
                    />
                  ))}
                  {/* Spacer matching the add-frame cell so row widths stay aligned */}
                  <div className={styles.addFrameSpacer} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layer context menu (from timeline label column) */}
      {layerCtxMenu && (() => {
        const lid = layerCtxMenu.layerId;
        const items: ContextMenuItem[] = [
          {
            type: 'item',
            label: 'Rename',
            onClick: () => {
              const layer = useLayerStore.getState().layers.find((l) => l.id === lid);
              if (layer) { setRenamingLayerName(layer.name); setRenamingLayerId(lid); }
              setLayerCtxMenu(null);
            },
          },
          {
            type: 'item',
            label: 'Duplicate layer',
            onClick: () => { layerActions.duplicateLayer(lid); setLayerCtxMenu(null); },
          },
          {
            type: 'item',
            label: 'Merge down',
            onClick: () => { layerActions.mergeDown(lid); setLayerCtxMenu(null); },
          },
          { type: 'separator' },
          {
            type: 'item',
            label: 'Delete layer',
            danger: true,
            onClick: () => { layerActions.removeLayer(lid); setLayerCtxMenu(null); },
          },
        ];
        return (
          <ContextMenu
            items={items}
            anchor={layerCtxMenu.anchor}
            onClose={() => setLayerCtxMenu(null)}
          />
        );
      })()}

      {/* Tag context menu */}
      {tagContextMenu && (
        <div
          className={styles.tagCtxMenu}
          style={{ top: tagContextMenu.anchor.y, left: tagContextMenu.anchor.x }}
          onMouseLeave={() => setTagContextMenu(null)}
        >
          <button
            type="button"
            className={styles.tagCtxItem}
            onClick={() => {
              tagActions.deleteTag(tagContextMenu.id);
              setTagContextMenu(null);
            }}
          >
            Delete tag
          </button>
        </div>
      )}
    </div>
  );
}
