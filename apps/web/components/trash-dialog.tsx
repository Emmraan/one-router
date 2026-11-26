'use client';

import * as React from 'react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { usePermanentDeleteChat, useRestoreChat, useTrashChats } from '../hooks/use-chats';
import { ConfirmModal } from './confirm-modal';

interface TrashDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TrashDialog({ isOpen, onClose }: TrashDialogProps) {
  const { data: chats = [], isLoading } = useTrashChats(isOpen);
  const restore = useRestoreChat();
  const remove = usePermanentDeleteChat();
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    setError('');
    try {
      await restore.mutateAsync(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The chat could not be restored.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await remove.mutateAsync(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The chat could not be deleted.');
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/45 dark:bg-black/65 backdrop-blur-xs" />
      <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
        <div className="bg-white dark:bg-[#0d0d0d] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                <Trash2 size={16} />
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Trash</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition"
              aria-label="Close trash"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <p className="px-5 py-8 text-center text-xs text-zinc-500">Loading trash...</p>
            ) : chats.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-zinc-500">Trash is empty.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {chats.map((chat) => (
                  <li key={chat.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{chat.title}</p>
                      <p className="mt-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
                        Deleted {chat.deletedAt ? formatDate(chat.deletedAt) : 'recently'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleRestore(chat.id)}
                        disabled={restore.isPending}
                        className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw size={11} />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(chat.id)}
                        disabled={remove.isPending}
                        className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 px-2.5 py-1.5 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p role="alert" className="mx-5 mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { if (confirmId) void handleDelete(confirmId); }}
        title="Delete Forever"
        message="This permanently removes the chat, its messages, and its files. This cannot be undone."
        confirmLabel="Delete forever"
        variant="danger"
      />
    </>
  );
}
