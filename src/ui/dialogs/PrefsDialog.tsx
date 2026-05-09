import { useState, useEffect } from 'react';
import { useUIStore } from '../../state/useUIStore';
import { usePrefsStore, DEFAULT_KEYBINDINGS, findConflict } from '../../state/usePrefsStore';
import type { UiScale } from '../../state/usePrefsStore';
import { ipcPrefsSave, ipcPrefsReset } from '../../bridge/prefsIpc';
import type { Preferences } from '../../bridge/prefsIpc';
import styles from './PrefsDialog.module.css';

type Tab = 'general' | 'editor' | 'keybindings';

const UI_SCALES: UiScale[] = [0.9, 1.0, 1.25];

const ACTION_LABELS: Record<string, string> = {
  'tool.pencil':      'Pencil tool',
  'tool.eraser':      'Eraser tool',
  'tool.line':        'Line tool',
  'tool.eyedropper':  'Eyedropper tool',
  'tool.hand':        'Hand (pan) tool',
  'tool.zoom':        'Zoom tool',
  'color.swap':       'Swap colors',
  'color.reset':      'Reset colors',
  'file.new':         'File: New',
  'file.open':        'File: Open',
  'file.save':        'File: Save',
  'file.saveAs':      'File: Save As',
  'file.export':      'File: Export',
  'edit.undo':        'Undo',
  'edit.redo':        'Redo',
  'frame.add':        'Add frame',
  'frame.duplicate':  'Duplicate frame',
  'edit.preferences': 'Open Preferences',
};

export function PrefsDialog() {
  const open = useUIStore((s) => s.prefsDialog.open);
  const hide = () => useUIStore.getState().hidePrefsDialog();
  const store = usePrefsStore();

  const [tab, setTab] = useState<Tab>('general');

  // Draft state — only committed on Save
  const [draftScale, setDraftScale] = useState<UiScale>(store.uiScale);
  const [draftAutosave, setDraftAutosave] = useState(store.autosaveIntervalMinutes);
  const [draftMaxUndo, setDraftMaxUndo] = useState(store.maxUndoStack);
  const [draftFrameMs, setDraftFrameMs] = useState(store.defaultFrameDurationMs);
  const [draftBindings, setDraftBindings] = useState<Record<string, string>>({ ...store.keybindings });

  // Keybinding capture state
  const [capturingId, setCapturingId] = useState<string | null>(null);

  // Reset draft when dialog opens
  useEffect(() => {
    if (!open) return;
    setTab('general');
    setDraftScale(store.uiScale);
    setDraftAutosave(store.autosaveIntervalMinutes);
    setDraftMaxUndo(store.maxUndoStack);
    setDraftFrameMs(store.defaultFrameDurationMs);
    setDraftBindings({ ...store.keybindings });
    setCapturingId(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture keydown for binding row in listening mode
  useEffect(() => {
    if (!capturingId) return;
    function onKey(e: KeyboardEvent) {
      // Ignore bare modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      const key = e.key === ' ' ? 'Space' : e.key;
      parts.push(key.length === 1 ? key.toLowerCase() : key);
      const combo = parts.join('+');
      const capturedId = capturingId!;

      setDraftBindings((prev) => ({ ...prev, [capturedId]: combo }));
      setCapturingId(null);
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [capturingId]);

  // Escape cancels capture or closes dialog
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (capturingId) { setCapturingId(null); return; }
      hide();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, capturingId, hide]);

  if (!open) return null;

  // Find conflicts in current draft
  const conflicts = new Set<string>();
  for (const actionId of Object.keys(draftBindings)) {
    const combo = draftBindings[actionId] ?? '';
    const conflict = findConflict(draftBindings, combo, actionId);
    if (conflict) { conflicts.add(actionId); conflicts.add(conflict); }
  }
  const hasConflicts = conflicts.size > 0;

  function buildPrefs(): Preferences {
    const overrides: Record<string, string> = {};
    for (const [id, combo] of Object.entries(draftBindings)) {
      if (combo !== DEFAULT_KEYBINDINGS[id]) overrides[id] = combo;
    }
    return {
      schema_version: 1,
      ui: { scale: draftScale },
      editor: {
        autosave_interval_minutes: draftAutosave,
        max_undo_stack: draftMaxUndo,
        default_frame_duration_ms: draftFrameMs,
      },
      keybindings: { overrides },
      recent: { files: [] }, // recent is not edited here; Rust merges with existing
    };
  }

  async function handleSave() {
    if (hasConflicts) return;
    const prefs = buildPrefs();
    await ipcPrefsSave(prefs).catch(() => null);
    store.setUiScale(draftScale);
    if (store.setKeybinding) Object.entries(draftBindings).forEach(([id, c]) => store.setKeybinding(id, c));
    hide();
  }

  async function handleReset() {
    const defaults = await ipcPrefsReset().catch(() => null);
    if (!defaults) return;
    usePrefsStore.getState().resetAll();
    setDraftScale(1.0);
    setDraftAutosave(5);
    setDraftMaxUndo(1000);
    setDraftFrameMs(100);
    setDraftBindings({ ...DEFAULT_KEYBINDINGS });
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) hide(); }}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Preferences">

        <div className={styles.header}>
          <span className={styles.title}>Preferences</span>
          <button className={styles.closeBtn} onClick={hide} aria-label="Close">✕</button>
        </div>

        <div className={styles.tabs}>
          {(['general', 'editor', 'keybindings'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`${styles.tab}${tab === t ? ` ${styles.tabActive}` : ''}`}
              onClick={() => { setCapturingId(null); setTab(t); }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.body}>

          {/* ── General ── */}
          {tab === 'general' && (
            <div className={styles.section}>
              <span className={styles.label}>UI Scale</span>
              <div className={styles.scaleGroup}>
                {UI_SCALES.map((s) => (
                  <button
                    key={s}
                    className={`${styles.scaleBtn}${draftScale === s ? ` ${styles.scaleBtnActive}` : ''}`}
                    onClick={() => setDraftScale(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <p className={styles.hint}>Applies immediately on Save.</p>
            </div>
          )}

          {/* ── Editor ── */}
          {tab === 'editor' && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Auto-save interval (minutes)</span>
                <input
                  type="number"
                  className={styles.numInput}
                  value={draftAutosave}
                  min={1}
                  max={60}
                  onChange={(e) => setDraftAutosave(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Max undo stack depth</span>
                <input
                  type="number"
                  className={styles.numInput}
                  value={draftMaxUndo}
                  min={100}
                  max={5000}
                  onChange={(e) => setDraftMaxUndo(Math.min(5000, Math.max(100, parseInt(e.target.value) || 100)))}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Default frame duration (ms)</span>
                <input
                  type="number"
                  className={styles.numInput}
                  value={draftFrameMs}
                  min={1}
                  max={9999}
                  onChange={(e) => setDraftFrameMs(Math.min(9999, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>
            </>
          )}

          {/* ── Keybindings ── */}
          {tab === 'keybindings' && (
            <div className={styles.kbTable}>
              {Object.keys(DEFAULT_KEYBINDINGS).map((actionId) => {
                const combo = draftBindings[actionId] ?? DEFAULT_KEYBINDINGS[actionId];
                const isCapturing = capturingId === actionId;
                const hasConflict = conflicts.has(actionId);
                const isDefault = combo === DEFAULT_KEYBINDINGS[actionId];

                return (
                  <div key={actionId} className={`${styles.kbRow}${hasConflict ? ` ${styles.kbConflict}` : ''}`}>
                    <span className={styles.kbLabel}>{ACTION_LABELS[actionId] ?? actionId}</span>
                    <button
                      className={`${styles.kbCapture}${isCapturing ? ` ${styles.kbCaptureActive}` : ''}`}
                      onClick={() => setCapturingId(isCapturing ? null : actionId)}
                    >
                      {isCapturing ? 'Press a key…' : combo}
                    </button>
                    {!isDefault && (
                      <button
                        className={styles.kbReset}
                        title="Reset to default"
                        onClick={() => setDraftBindings((prev) => ({
                          ...prev,
                          [actionId]: DEFAULT_KEYBINDINGS[actionId] ?? '',
                        }))}
                      >
                        ↺
                      </button>
                    )}
                    {hasConflict && <span className={styles.conflictChip}>Conflict</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnReset}`} onClick={() => void handleReset()}>
            Reset to Defaults
          </button>
          <div className={styles.footerSpacer} />
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={hide}>
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.btnSave}`}
            onClick={() => void handleSave()}
            disabled={hasConflicts}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
