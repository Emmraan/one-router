'use client';

import * as React from 'react';
import { Plus, Settings, PanelLeftClose, PanelLeftOpen, Pin, Search, Trash2, Plug, X } from 'lucide-react';
import { Wordmark } from '@one-router/ui/brand';
import type { Chat } from '../lib/provider-types';
import { useChatSearch } from '../hooks/use-chats';
import { ConfirmModal } from './confirm-modal';
import { SidebarChatItem } from './sidebar-chat-item';
import { TrashDialog } from './trash-dialog';

interface SidebarProps {
  isOpen: boolean; onToggle: () => void; chats: Chat[]; activeChatId: string | null;
  onSelectChat: (id: string) => void; onNewChat: () => void;
  onDeleteChat: (id: string) => void; onRenameChat: (id: string, title: string) => void;
  onOpenDashboard: () => void; onOpenSettings: () => void; onTogglePin: (id: string) => void;
  onSaveTemporary?: (id: string) => void; savingTemporary?: boolean;
}

function formatTime(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  return days < 1 ? 'Today' : days === 1 ? 'Yesterday' : new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Sidebar({ isOpen, onToggle, chats, activeChatId, onSelectChat, onNewChat, onDeleteChat,
  onRenameChat, onOpenDashboard, onOpenSettings, onTogglePin, onSaveTemporary, savingTemporary }: SidebarProps) {
  const [editingChatId, setEditingChatId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [trashOpen, setTrashOpen] = React.useState(false);
  const { data: searchResults = [], isFetching, error } = useChatSearch(debouncedSearch);
  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);
  const visible: Chat[] = debouncedSearch ? searchResults.map((chat) => ({ ...chat, messages: [] })) : chats;
  const pinned = visible.filter((chat) => chat.isPinned);
  const recent = visible.filter((chat) => !chat.isPinned);
  const renderChat = (chat: Chat) => <SidebarChatItem key={chat.id} chat={chat} activeChatId={activeChatId}
    editingChatId={editingChatId} renameValue={renameValue} isPinned={Boolean(chat.isPinned)}
    onSelect={onSelectChat} onStartRename={(item, event) => { event.stopPropagation(); setEditingChatId(item.id); setRenameValue(item.title); }}
    onSaveRename={(id) => { if (renameValue.trim()) onRenameChat(id, renameValue.trim()); setEditingChatId(null); }}
    onCancelRename={() => setEditingChatId(null)} onRenameValueChange={setRenameValue} onTogglePin={onTogglePin}
    onDeleteClick={setDeleteConfirmId} onSaveTemporary={onSaveTemporary} savingTemporary={savingTemporary} formatTime={formatTime} />;
  return <>
    <aside id="onerouter-sidebar-shell" className={`app-sidebar ${isOpen ? '' : 'sidebar-collapsed'}`} aria-label="Workspace">
      <div className="sidebar-brand">{isOpen ? <Wordmark /> : <button className="icon-button" id="collapsed-app-logo" aria-label="Expand sidebar" title="Expand sidebar" onClick={onToggle}><PanelLeftOpen size={18} /></button>}
        {isOpen && <button className="icon-button" id="collapse-sidebar-chevron" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={onToggle}><PanelLeftClose size={17} /></button>}
      </div>
      <div className="sidebar-tools">
        <button type="button" id={isOpen ? 'btn-new-chat' : 'btn-collapsed-new-chat'} className={isOpen ? 'button sidebar-new' : 'icon-button'} aria-label="New chat" onClick={onNewChat}><Plus size={17} />{isOpen && 'New chat'}</button>
        {isOpen ? <div className="sidebar-search"><Search size={15} /><input id="search-chats-input" type="search" placeholder="Search chats" aria-label="Search chats" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />{searchQuery && <button className="icon-button" aria-label="Clear search" onClick={() => setSearchQuery('')}><X size={13} /></button>}</div>
          : <button className="icon-button" aria-label="Search chats" onClick={onToggle}><Search size={17} /></button>}
      </div>
      {isOpen && <nav className="sidebar-history" aria-label="Chat history">
        {error && <p role="alert" className="error-notice p-3">Could not search chats. Try again.</p>}
        {debouncedSearch && isFetching && <p role="status" className="muted p-3">Searching…</p>}
        {pinned.length > 0 && <><h2><Pin size={12} />Pinned</h2>{pinned.map(renderChat)}</>}
        <h2>{debouncedSearch ? 'Search results' : 'Recent chats'}</h2>
        {visible.length === 0 ? <p className="history-empty">{debouncedSearch ? 'No matching chats.' : 'Your saved chats will appear here.'}</p> : recent.map(renderChat)}
      </nav>}
      <div className="sidebar-footer">
        <button type="button" id="open-providers-dashboard" className="sidebar-link" onClick={onOpenDashboard} aria-label="Providers" title="Providers"><Plug size={17} />{isOpen && 'Providers'}</button>
        <button type="button" id="open-trash" className="sidebar-link" onClick={() => setTrashOpen(true)} aria-label="Trash" title="Trash"><Trash2 size={17} />{isOpen && 'Trash'}</button>
        <button type="button" className="sidebar-link" onClick={onOpenSettings} aria-label="Settings" title="Settings"><Settings size={17} />{isOpen && 'Settings'}</button>
      </div>
    </aside>
    <ConfirmModal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)}
      onConfirm={() => { if (deleteConfirmId) onDeleteChat(deleteConfirmId); }} title="Move chat to Trash?"
      message="You can restore this chat and its messages from Trash." confirmLabel="Move to Trash" variant="danger" />
    <TrashDialog isOpen={trashOpen} onClose={() => setTrashOpen(false)} />
  </>;
}
