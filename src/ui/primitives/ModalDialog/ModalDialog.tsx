import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button } from '../Button/Button';
import { IconClose } from '../../../assets/icons/IconClose';
import styles from './ModalDialog.module.css';

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'lg';
  closeOnOverlayClick?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function ModalDialog({
  isOpen,
  onClose,
  title,
  size = 'sm',
  closeOnOverlayClick = true,
  children,
  footer,
}: ModalDialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={
        closeOnOverlayClick
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={[styles.dialog, styles[size]].join(' ')}
      >
        <div className={styles.header}>
          <span id="modal-title" className={styles.title}>
            {title}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <IconClose size={16} />
          </Button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
