import { useState } from 'react';
import { ContextMenu } from '../../primitives/ContextMenu/ContextMenu';
import type { ContextMenuItem } from '../../primitives/ContextMenu/ContextMenu';
import styles from '../DevHarness.module.css';

const ITEMS: ContextMenuItem[] = [
  { type: 'item', label: 'Copy', shortcut: 'Ctrl+C', onClick: () => {} },
  { type: 'item', label: 'Paste', shortcut: 'Ctrl+V', onClick: () => {} },
  { type: 'separator' },
  { type: 'item', label: 'Rename', onClick: () => {} },
  { type: 'item', label: 'Disabled item', disabled: true, onClick: () => {} },
  { type: 'separator' },
  { type: 'item', label: 'Delete', danger: true, onClick: () => {} },
];

export function ContextMenuSection(): JSX.Element {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className={styles.section}>
      <h2>ContextMenu</h2>
      <p className={styles.label}>Right-click the area below to open the context menu</p>
      <div
        style={{
          width: 300,
          height: 100,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          cursor: 'context-menu',
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setAnchor({ x: e.clientX, y: e.clientY });
        }}
      >
        Right-click here
      </div>
      {anchor && <ContextMenu items={ITEMS} anchor={anchor} onClose={() => setAnchor(null)} />}
    </div>
  );
}
