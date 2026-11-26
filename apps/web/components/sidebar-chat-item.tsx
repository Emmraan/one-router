'use client';

import * as React from 'react';
import { MessageSquare, Pin, X, Check, Trash2, Edit2 } from 'lucide-react';
import { Chat } from '../lib/provider-types';

interface SidebarChatItemProps {
  chat: Chat;
  activeChatId: string | null;
  editingChatId: string | null;
  renameValue: string;
  isPinned: boolean;
  onSelect: (id: string) => void;
  onStartRename: (chat: Chat, e: React.MouseEvent) => void;
  onSaveRename: (id: string) => void;
  onCancelRename: () => void;
  onRenameValueChange: (val: string) => void;
  onTogglePin: (id: string) => void;
  onDeleteClick: (id: string) => void;
  formatTime: (ts: number) => string;
}

export function SidebarChatItem({
  chat, activeChatId, editingChatId, renameValue, isPinned,
  onSelect, onStartRename, onSaveRename, onCancelRename,
  onRenameValueChange, onTogglePin, onDeleteClick, formatTime,
}: SidebarChatItemProps) {
  const isEditing = editingChatId === chat.id;

  return (
    <div
      onClick={() => !isEditing && onSelect(chat.id)}
      className={`group relative flex flex-col justify-between px-3 py-2.5 rounded-xl text-xs transition border border-transparent cursor-pointer select-none ${
        activeChatId === chat.id
          ? 'bg-zinc-100 dark:bg-zinc-900/70 text-zinc-950 dark:text-zinc-100 border-zinc-200/50 dark:border-zinc-800/60 font-semibold'
          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-150/40 dark:hover:bg-zinc-900/10'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-6">
        <MessageSquare size={13} className={activeChatId === chat.id ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-700'} />
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              className="flex-1 bg-zinc-200/50 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1.5 py-0.5 text-xs text-zinc-900 dark:text-white font-medium"
            />
            <button type="button" onClick={onCancelRename} className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Cancel"><X size={11} /></button>
            <button type="button" onClick={() => onSaveRename(chat.id)} className="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Save"><Check size={11} /></button>
          </div>
        ) : (
          <span className="truncate flex-1 font-semibold text-zinc-800 dark:text-zinc-100">{chat.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400 dark:text-zinc-600 font-semibold">
          <span>{formatTime(chat.updatedAt || chat.createdAt)}</span>
          <div className="flex items-center gap-1 text-[9px] font-bold">
            {isPinned && <Pin size={8} className="fill-current text-emerald-500 shrink-0" />}
          </div>
        </div>
      )}

      {!isEditing && (
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center bg-white dark:bg-[#0d0d0d] rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl py-0.5 px-1 gap-0.5 z-10">
          <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePin(chat.id); }} className={`p-1 rounded ${isPinned ? 'text-emerald-500' : 'text-zinc-400'} hover:text-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900`} title={isPinned ? 'Unpin Thread' : 'Pin Thread'}><Pin size={10} className={isPinned ? 'fill-current' : ''} /></button>
          <button type="button" onClick={(e) => onStartRename(chat, e)} className="p-1 rounded text-zinc-450 hover:text-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900" title="Rename Thread"><Edit2 size={10} /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteClick(chat.id); }} className="p-1 rounded text-zinc-450 hover:text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900" title="Delete Thread"><Trash2 size={10} /></button>
        </div>
      )}
    </div>
  );
}
