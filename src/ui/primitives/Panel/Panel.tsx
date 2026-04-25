import { useState, type ReactNode } from 'react';
import { IconChevronRight } from '../../../assets/icons/IconChevronRight';
import styles from './Panel.module.css';

interface PanelProps {
  title: string;
  defaultExpanded?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, defaultExpanded = true, actions, children, className }: PanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={[styles.panel, className].filter(Boolean).join(' ')}>
      <div
        className={styles.header}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <IconChevronRight
          size={12}
          className={[styles.chevron, expanded ? styles.expanded : ''].filter(Boolean).join(' ')}
        />
        <span className={styles.title}>{title}</span>
        {actions && (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      <div className={[styles.body, !expanded ? styles.collapsed : ''].filter(Boolean).join(' ')}>{children}</div>
    </section>
  );
}
