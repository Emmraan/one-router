'use client';

import { Database, Save, Timer, Trash2 } from 'lucide-react';

interface ChatActionsProps {
  temporary: boolean;
  saving: boolean;
  onCreateTemporary: () => void;
  onSaveTemporary: () => void;
  onDiscardTemporary: () => void;
  onOpenData: () => void;
}

export function ChatActions({
  temporary,
  saving,
  onCreateTemporary,
  onSaveTemporary,
  onDiscardTemporary,
  onOpenData,
}: ChatActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {temporary ? (
        <>
          <span className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Timer size={11} />
            Temporary
          </span>
          <button
            type="button"
            onClick={onSaveTemporary}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono bg-emerald-500 text-black border border-emerald-600 hover:bg-emerald-400 disabled:opacity-50 transition cursor-pointer"
            id="save-temporary-chat"
            title="Save this temporary chat"
          >
            <Save size={12} />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
          <button
            type="button"
            onClick={onDiscardTemporary}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-red-600 hover:border-red-300 disabled:opacity-50 transition cursor-pointer"
            id="discard-temporary-chat"
            title="Discard this temporary chat"
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Discard</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onCreateTemporary}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          id="new-temporary-chat"
          title="Start a chat that is not saved"
        >
          <Timer size={12} />
          <span className="hidden sm:inline">Temporary</span>
        </button>
      )}
      <button
        type="button"
        onClick={onOpenData}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
        id="open-data-dialog"
        title="Export or import data"
      >
        <Database size={12} />
        <span className="hidden md:inline">Data</span>
      </button>
    </div>
  );
}
