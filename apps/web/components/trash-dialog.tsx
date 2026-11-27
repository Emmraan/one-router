'use client';
import * as React from 'react';
import { Dialog } from '@one-router/ui/dialog';
import { RotateCcw, Trash2 } from 'lucide-react';
import { usePermanentDeleteChat, useRestoreChat, useTrashChats } from '../hooks/use-chats';
import { ConfirmModal } from './confirm-modal';

export function TrashDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: chats = [], isLoading, isError } = useTrashChats(isOpen);
  const restore = useRestoreChat(); const remove = usePermanentDeleteChat();
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  async function act(id: string, permanent = false) {
    setError('');
    try { if (permanent) await remove.mutateAsync(id); else await restore.mutateAsync(id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The chat could not be updated. Try again.'); }
  }
  return <>
    <Dialog open={isOpen} onClose={onClose} title="Trash" description="Restore a conversation or delete it permanently."><div className="dialog-body">
      {(error || isError) && <p role="alert" className="error-notice mb-4">{error || 'Could not load trash. Close and try again.'}</p>}
      {isLoading ? <p className="muted py-6" role="status">Loading trash...</p> : !chats.length ? <p className="muted py-6">Trash is empty.</p> : <ul className="divide-y divide-[var(--border)]">{chats.map((chat) => <li key={chat.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate font-medium">{chat.title}</p><p className="muted text-xs mt-1">Deleted {chat.deletedAt ? new Date(chat.deletedAt).toLocaleDateString() : 'recently'}</p></div><div className="flex shrink-0 gap-2"><button className="button" disabled={restore.isPending} onClick={() => void act(chat.id)}><RotateCcw size={14} /> Restore</button><button className="icon-button" aria-label={`Delete ${chat.title} forever`} disabled={remove.isPending} onClick={() => setConfirmId(chat.id)}><Trash2 size={15} /></button></div></li>)}</ul>}
    </div><div className="dialog-footer"><button className="button" onClick={onClose}>Close</button></div></Dialog>
    <ConfirmModal isOpen={confirmId !== null} onClose={() => setConfirmId(null)} onConfirm={() => { if (confirmId) void act(confirmId, true); }} title="Delete forever?" message="This permanently removes the chat, its messages, and its files. This cannot be undone." confirmLabel="Delete forever" />
  </>;
}
