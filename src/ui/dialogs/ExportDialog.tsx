import { useState, useCallback } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { useUIStore } from '../../state/useUIStore';
import { useProjectStore } from '../../state/useProjectStore';
import { useFrameStore } from '../../state/useFrameStore';
import { exportActions } from '../../state/action-composers';
import type { ExportProgress } from '../../bridge/exportIpc';
import type { SheetLayout } from '../../bridge/exportIpc';
import styles from './ExportDialog.module.css';

type Tab = 'png' | 'spritesheet' | 'gif';
type Scale = 1 | 2 | 4 | 8 | 16;
const SCALES: Scale[] = [1, 2, 4, 8, 16];
type GifScale = 1 | 2 | 4;
const GIF_SCALES: GifScale[] = [1, 2, 4];

export function ExportDialog() {
  const open = useUIStore((s) => s.exportDialog.open);
  const hide = () => useUIStore.getState().hideExportDialog();
  const projectName = useProjectStore((s) => s.meta.name);
  const frameCount = useFrameStore((s) => s.frames.length);
  const activeFrameIndex = useFrameStore((s) => s.activeFrameIndex);

  const [tab, setTab] = useState<Tab>('png');

  // PNG tab state
  const [pngMode, setPngMode] = useState<'current' | 'all'>('current');
  const [pngScale, setPngScale] = useState<Scale>(1);
  const [pngBg, setPngBg] = useState(false);
  const [pngDir, setPngDir] = useState('');

  // GIF tab state
  const [gifScale, setGifScale] = useState<GifScale>(1);
  const [gifLoopCount, setGifLoopCount] = useState(0);
  const [gifDither, setGifDither] = useState(false);
  const [gifPath, setGifPath] = useState('');

  // Spritesheet tab state
  const [sheetLayoutType, setSheetLayoutType] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal');
  const [sheetColumns, setSheetColumns] = useState(4);
  const [sheetPadding, setSheetPadding] = useState(0);
  const [sheetScale, setSheetScale] = useState<Scale>(1);
  const [sheetBg, setSheetBg] = useState(false);
  const [sheetPath, setSheetPath] = useState('');
  const [sidecarJson, setSidecarJson] = useState(true);

  // Progress
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exporting, setExporting] = useState(false);

  const onProgress = useCallback((p: ExportProgress) => setProgress(p), []);

  if (!open) return null;

  const handlePickDir = async () => {
    const selected = await openDialog({ directory: true, multiple: false }).catch(() => null);
    if (typeof selected === 'string') setPngDir(selected);
  };

  const handlePickFile = async () => {
    const selected = await saveDialog({
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      defaultPath: `${projectName}_spritesheet.png`,
    }).catch(() => null);
    if (typeof selected === 'string') setSheetPath(selected);
  };

  const handlePickGifFile = async () => {
    const selected = await saveDialog({
      filters: [{ name: 'GIF Animation', extensions: ['gif'] }],
      defaultPath: `${projectName}.gif`,
    }).catch(() => null);
    if (typeof selected === 'string') setGifPath(selected);
  };

  const handleExport = async () => {
    setExporting(true);
    setProgress(null);

    if (tab === 'png') {
      await exportActions.exportPng(
        {
          frameSelection: pngMode === 'current'
            ? { type: 'current', index: activeFrameIndex }
            : { type: 'all' },
          scale: pngScale,
          includeBackground: pngBg,
          outputDir: pngDir,
          namePrefix: projectName,
        },
        onProgress,
      );
    } else if (tab === 'spritesheet') {
      const layout: SheetLayout =
        sheetLayoutType === 'grid'
          ? { type: 'grid', columns: sheetColumns }
          : { type: sheetLayoutType };

      await exportActions.exportSpritesheet(
        {
          layout,
          padding: sheetPadding,
          scale: sheetScale,
          includeBackground: sheetBg,
          outputPath: sheetPath,
          sidecarJson,
        },
        onProgress,
      );
    } else {
      await exportActions.exportGif(
        {
          scale: gifScale,
          loopCount: gifLoopCount,
          dither: gifDither,
          outputPath: gifPath,
        },
        onProgress,
      );
    }

    setExporting(false);
    setProgress(null);
  };

  const exportDisabled =
    exporting ||
    (tab === 'png' && !pngDir) ||
    (tab === 'spritesheet' && !sheetPath) ||
    (tab === 'gif' && !gifPath);

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Export">

        <div className={styles.tabs}>
          <button
            className={`${styles.tab}${tab === 'png' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setTab('png')}
          >
            PNG Frames
          </button>
          <button
            className={`${styles.tab}${tab === 'spritesheet' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setTab('spritesheet')}
          >
            Spritesheet
          </button>
          <button
            className={`${styles.tab}${tab === 'gif' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setTab('gif')}
          >
            GIF
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'png' && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Frame</span>
                <div className={styles.radioGroup}>
                  <button
                    className={`${styles.radioBtn}${pngMode === 'current' ? ` ${styles.radioBtnActive}` : ''}`}
                    onClick={() => setPngMode('current')}
                  >
                    Current frame
                  </button>
                  <button
                    className={`${styles.radioBtn}${pngMode === 'all' ? ` ${styles.radioBtnActive}` : ''}`}
                    onClick={() => setPngMode('all')}
                  >
                    All frames ({frameCount})
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Scale</span>
                <div className={styles.scaleGroup}>
                  {SCALES.map((s) => (
                    <button
                      key={s}
                      className={`${styles.scaleBtn}${pngScale === s ? ` ${styles.scaleBtnActive}` : ''}`}
                      onClick={() => setPngScale(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              <label className={styles.checkRow}>
                <input type="checkbox" checked={pngBg} onChange={(e) => setPngBg(e.target.checked)} />
                Include canvas background
              </label>

              <div className={styles.field}>
                <span className={styles.label}>Output directory</span>
                <div className={styles.pathRow}>
                  <span className={styles.pathDisplay}>{pngDir || 'No folder selected'}</span>
                  <button className={styles.pathBtn} onClick={() => void handlePickDir()}>Browse…</button>
                </div>
              </div>
            </>
          )}

          {tab === 'spritesheet' && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Layout</span>
                <div className={styles.radioGroup}>
                  {(['horizontal', 'vertical', 'grid'] as const).map((l) => (
                    <button
                      key={l}
                      className={`${styles.radioBtn}${sheetLayoutType === l ? ` ${styles.radioBtnActive}` : ''}`}
                      onClick={() => setSheetLayoutType(l)}
                    >
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
                {sheetLayoutType === 'grid' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Columns</span>
                    <input
                      type="number"
                      className={styles.numInput}
                      value={sheetColumns}
                      min={1}
                      max={frameCount || 1}
                      onChange={(e) => setSheetColumns(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Padding (px between frames)</span>
                <input
                  type="number"
                  className={styles.numInput}
                  value={sheetPadding}
                  min={0}
                  max={16}
                  onChange={(e) => setSheetPadding(Math.min(16, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Scale</span>
                <div className={styles.scaleGroup}>
                  {SCALES.map((s) => (
                    <button
                      key={s}
                      className={`${styles.scaleBtn}${sheetScale === s ? ` ${styles.scaleBtnActive}` : ''}`}
                      onClick={() => setSheetScale(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              <label className={styles.checkRow}>
                <input type="checkbox" checked={sheetBg} onChange={(e) => setSheetBg(e.target.checked)} />
                Include canvas background
              </label>

              <label className={styles.checkRow}>
                <input type="checkbox" checked={sidecarJson} onChange={(e) => setSidecarJson(e.target.checked)} />
                Write sidecar JSON (Godot / Unity compatible)
              </label>

              <div className={styles.field}>
                <span className={styles.label}>Output file</span>
                <div className={styles.pathRow}>
                  <span className={styles.pathDisplay}>{sheetPath || 'No file selected'}</span>
                  <button className={styles.pathBtn} onClick={() => void handlePickFile()}>Browse…</button>
                </div>
              </div>
            </>
          )}

          {tab === 'gif' && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Scale</span>
                <div className={styles.scaleGroup}>
                  {GIF_SCALES.map((s) => (
                    <button
                      key={s}
                      className={`${styles.scaleBtn}${gifScale === s ? ` ${styles.scaleBtnActive}` : ''}`}
                      onClick={() => setGifScale(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Loop count (0 = infinite)</span>
                <input
                  type="number"
                  className={styles.numInput}
                  value={gifLoopCount}
                  min={0}
                  max={65535}
                  onChange={(e) => setGifLoopCount(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>

              <label className={styles.checkRow}>
                <input type="checkbox" checked={gifDither} onChange={(e) => setGifDither(e.target.checked)} />
                Ordered dithering (better quality, larger file)
              </label>

              <div className={styles.field}>
                <span className={styles.label}>Output file</span>
                <div className={styles.pathRow}>
                  <span className={styles.pathDisplay}>{gifPath || 'No file selected'}</span>
                  <button className={styles.pathBtn} onClick={() => void handlePickGifFile()}>Browse…</button>
                </div>
              </div>
            </>
          )}

          {progress && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={hide} disabled={exporting}>
            Cancel
          </button>
          <div className={styles.footerSpacer} />
          <button
            className={`${styles.btn} ${styles.btnExport}`}
            onClick={() => void handleExport()}
            disabled={exportDisabled}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
