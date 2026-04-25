import * as Icons from '../../../assets/icons';
import styles from '../DevHarness.module.css';

export function IconSection(): JSX.Element {
  return (
    <div className={styles.section}>
      <h2>Icons (27 × 16px)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        {Object.entries(Icons).map(([name, Icon]) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }}>
            <div
              style={{
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Icon size={16} />
            </div>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
                wordBreak: 'break-all',
              }}
            >
              {name.replace('Icon', '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
