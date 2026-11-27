'use client';
import { Dialog } from '@one-router/ui/dialog';

interface TemporaryExitModalProps {
  isOpen: boolean; saving: boolean; error: string | null;
  onCancel: () => void; onDiscard: () => void; onSave: () => void;
}
export function TemporaryExitModal({ isOpen, saving, error, onCancel, onDiscard, onSave }: TemporaryExitModalProps) {
  return <Dialog open={isOpen} onClose={() => { if (!saving) onCancel(); }} title="Save this temporary chat?" className="!max-w-lg">
    <div className="dialog-body space-y-4"><p className="muted leading-relaxed">Save the conversation to your history, or discard it when you leave. Temporary chats are kept only for this session.</p>{error && <p className="error-notice" role="alert">{error}</p>}</div>
    <div className="dialog-footer"><button className="button" onClick={onCancel} disabled={saving} data-autofocus>Keep chatting</button><button className="button danger" onClick={onDiscard} disabled={saving}>Discard</button><button className="button primary" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save chat'}</button></div>
  </Dialog>;
}
