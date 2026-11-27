'use client';
import { Dialog } from '@one-router/ui/dialog';

interface ConfirmModalProps {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'default';
}
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger' }: ConfirmModalProps) {
  return <Dialog open={isOpen} onClose={onClose} title={title} className="!max-w-md">
    <p className="dialog-body muted leading-relaxed">{message}</p>
    <div className="dialog-footer"><button className="button" onClick={onClose} data-autofocus>Cancel</button><button className={`button ${variant === 'danger' ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div>
  </Dialog>;
}
