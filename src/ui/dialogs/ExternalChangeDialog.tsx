import { useUIStore } from '../../state/useUIStore';
import { fileActions } from '../../state/action-composers';

export function ExternalChangeDialog() {
  const { open, changedPath } = useUIStore((s) => s.externalChangeDialog);
  const hideDialog = useUIStore((s) => s.hideExternalChangeDialog);

  if (!open || !changedPath) return null;

  function handleReload() {
    fileActions.reloadFromDisk(changedPath!);
  }

  function handleKeep() {
    hideDialog();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-5)',
          width: 380,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)',
        }}
      >
        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
          File Changed Externally
        </strong>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          The file was modified by another program. Do you want to reload it?
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', lineHeight: 1.4 }}>
          Warning: Reloading will discard any unsaved changes in this session.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
          <button
            onClick={handleKeep}
            style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Keep My Version
          </button>
          <button
            onClick={handleReload}
            style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Reload from Disk
          </button>
        </div>
      </div>
    </div>
  );
}
