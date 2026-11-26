'use client';

import { AlertTriangle, Save, Trash2, X } from 'lucide-react';

interface TemporaryExitModalProps {
  isOpen: boolean;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function TemporaryExitModal({
  isOpen,
  saving,
  error,
  onCancel,
  onDiscard,
  onSave,
}: TemporaryExitModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/45 dark:bg-black/65 backdrop-blur-xs" />
      <div className="fixed inset-0 z-[71] flex items-center justify-center pointer-events-none">
        <div className="bg-white dark:bg-[#0d0d0d] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={16} />
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Leave temporary chat?</h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This chat exists only in this browser tab. Save it to keep the conversation, or discard it and its files.
            </p>
            {error && (
              <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 disabled:opacity-50 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 cursor-pointer transition"
            >
              <Trash2 size={12} />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-zinc-950 hover:bg-zinc-900 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-black text-white disabled:opacity-50 cursor-pointer transition"
            >
              <Save size={12} />
              <span>{saving ? 'Saving...' : 'Save chat'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
