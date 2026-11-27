'use client';

import * as React from 'react';
import { MessageSquare, Pin, X, Check, Trash2, Edit2 } from 'lucide-react';
import type { Chat } from '../lib/provider-types';

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
  onSaveTemporary?: (id: string) => void;
  savingTemporary?: boolean;
  formatTime: (ts: number) => string;
}

export function SidebarChatItem({
  chat, activeChatId, editingChatId, renameValue, isPinned,
  onSelect, onStartRename, onSaveRename, onCancelRename,
  onRenameValueChange, onTogglePin, onDeleteClick, onSaveTemporary,
  savingTemporary = false, formatTime,
}: SidebarChatItemProps) {
  const isEditing = editingChatId === chat.id;
  const temporary = chat.id.startsWith('temporary-');

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(chat.id);
    }
  };

  return (
    <div
      onClick={() => !isEditing && onSelect(chat.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-current={activeChatId === chat.id ? 'true' : undefined}
      className="chat-row group"
    >
      <div className="flex items-center gap-2 min-w-0 pr-6">
        <MessageSquare size={14} className="muted shrink-0" />
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              value={renameValue}
              maxLength={80}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveRename(chat.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelRename();
                }
              }}
              aria-label="Chat title"
              className="field min-w-0 !p-1"
            />
            <button type="button" onClick={onCancelRename} className="icon-button" title="Cancel" aria-label="Cancel rename"><X size={14} /></button>
            <button type="button" onClick={() => onSaveRename(chat.id)} className="icon-button" title="Save" aria-label="Save rename"><Check size={14} /></button>
          </div>
        ) : (
          <span className="truncate flex-1">{chat.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center justify-between mt-1 ml-5 text-[10px] muted">
          <span>{temporary ? 'Not saved' : formatTime(chat.updatedAt || chat.createdAt)}</span>
          <div className="flex items-center gap-1 text-[9px] font-bold">
            {temporary && <span>Temporary</span>}
            {isPinned && <Pin size={10} className="fill-current shrink-0" />}
          </div>
        </div>
      )}

      {!isEditing && (
        <div className="chat-row-actions">
          {temporary ? (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSaveTemporary?.(chat.id); }}
                disabled={savingTemporary}
                className="icon-button"
                title="Save temporary chat"
                aria-label="Save temporary chat"
              >
                <Check size={10} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteClick(chat.id); }}
                className="icon-button"
                title="Discard temporary chat"
                aria-label="Discard temporary chat"
              >
                <Trash2 size={10} />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePin(chat.id); }} className="icon-button" title={isPinned ? 'Unpin Thread' : 'Pin Thread'} aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}><Pin size={13} className={isPinned ? 'fill-current' : ''} /></button>
              <button type="button" onClick={(e) => onStartRename(chat, e)} className="icon-button" title="Rename Thread" aria-label="Rename chat"><Edit2 size={13} /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteClick(chat.id); }} className="icon-button" title="Move Thread to Trash" aria-label="Move chat to trash"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
