'use client';

import * as React from 'react';
import {
  MessageSquare, Plus, Trash2, Edit2, Settings, Moon, Sun,
  X, Check, ChevronLeft, ChevronRight, Pin, Search, PanelLeftOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from '../lib/provider-types';
import { ConfirmModal } from './confirm-modal';
import { SidebarChatItem } from './sidebar-chat-item';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: (isTemporary?: boolean) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onOpenDashboard: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isTempMode: boolean;
  onTogglePin: (id: string) => void;
}

function formatLastUpdated(timestamp: number): string {
  if (!timestamp) return 'Just now';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Sidebar({
  isOpen, onToggle, chats, activeChatId, onSelectChat, onNewChat,
  onDeleteChat, onRenameChat, onOpenDashboard, theme, onToggleTheme,
  isTempMode, onTogglePin,
}: SidebarProps) {
  const [editingChatId, setEditingChatId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const checkViewport = () => setIsMobile(window.innerWidth < 768);
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const handleStartRename = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setRenameValue(chat.title);
  };

  const handleSaveRename = (id: string) => {
    if (renameValue.trim()) onRenameChat(id, renameValue.trim());
    setEditingChatId(null);
  };

  const handleCancelRename = () => setEditingChatId(null);

  const handleSelectChat = (id: string) => {
    onSelectChat(id);
    if (isMobile) onToggle();
  };

  const filteredChats = chats.filter((chat) => {
    if (!chat.isTemporary && !chat.committed) return false;
    const q = searchQuery.toLowerCase();
    if (chat.title.toLowerCase().includes(q)) return true;
    return chat.messages?.some((m) => m.content?.toLowerCase().includes(q));
  });

  const pinnedChats = filteredChats.filter((chat) => chat.isPinned);
  const unpinnedChats = filteredChats.filter((chat) => !chat.isPinned);

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.25 }} exit={{ opacity: 0 }} onClick={onToggle} className="fixed inset-0 z-40 bg-zinc-950 backdrop-blur-xs md:hidden" id="mobile-drawer-overlay" />
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={isOpen ? 'open' : 'collapsed'}
        variants={{
          open: { width: 288, x: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 28 } },
          collapsed: { width: isMobile ? 0 : 68, x: isMobile ? -288 : 0, transition: { type: 'spring' as const, stiffness: 260, damping: 28 } },
        }}
        className={`fixed md:relative top-0 left-0 h-full z-45 flex flex-col bg-white dark:bg-[#0d0d0d] border-r border-zinc-200 dark:border-zinc-800/60 text-gray-900 dark:text-zinc-300 overflow-hidden shadow-2xl md:shadow-none select-none`}
        id="onerouter-sidebar-shell"
      >
        {isOpen ? (
          <div className="flex flex-col h-full w-72 shrink-0">
            <div className="flex items-center justify-between p-4.5 border-b border-zinc-150 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-emerald-500 text-black font-mono font-bold text-xs tracking-tighter">1R</div>
                <div>
                  <span className="font-bold text-[14px] tracking-tight text-zinc-950 dark:text-white">ONE ROUTER</span>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-650 font-bold uppercase tracking-wider">HYPER-ROUTING v1.0.4</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={onToggle} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-450 cursor-pointer hidden md:block" title="Collapse sidebar (Ctrl+\)" id="collapse-sidebar-chevron"><ChevronLeft size={14} /></button>
                <button type="button" onClick={onToggle} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-450 cursor-pointer md:hidden" id="close-mobile-drawer"><X size={15} /></button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2 shrink-0">
              <button type="button" onClick={() => onNewChat(false)} className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/50 text-white dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold shadow-xs transition cursor-pointer" id="btn-new-chat"><Plus size={15} className="text-emerald-500" /> New Chat</button>
            </div>

            <div className="px-4 pb-3 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-650" />
                <input type="text" placeholder="Search chats..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/85 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all font-medium" id="search-chats-input" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-500 rounded cursor-pointer transition"><X size={11} /></button>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-4 scrollbar-thin">
              {pinnedChats.length > 0 && (
                <div>
                  <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">
                    <span className="flex items-center gap-1"><Pin size={10} className="fill-current text-emerald-500 rotate-45" /> Pinned</span>
                    <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 tracking-normal font-bold">{pinnedChats.length}</span>
                  </div>
                  <div className="space-y-1">
                    {pinnedChats.map((chat) => (
                      <SidebarChatItem key={chat.id} chat={chat} activeChatId={activeChatId} editingChatId={editingChatId} renameValue={renameValue} isPinned={true} onSelect={handleSelectChat} onStartRename={handleStartRename} onSaveRename={handleSaveRename} onCancelRename={handleCancelRename} onRenameValueChange={setRenameValue} onTogglePin={onTogglePin} onDeleteClick={setDeleteConfirmId} formatTime={formatLastUpdated} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="px-3 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1.5">Recent Threads</p>
                {(unpinnedChats.length === 0 && pinnedChats.length === 0) ? (
                  <div className="p-8 text-center text-zinc-400 dark:text-zinc-600">
                    <MessageSquare size={18} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                    <p className="text-[11px] font-semibold">No recorded nodes</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {unpinnedChats.map((chat) => (
                      <SidebarChatItem key={chat.id} chat={chat} activeChatId={activeChatId} editingChatId={editingChatId} renameValue={renameValue} isPinned={false} onSelect={handleSelectChat} onStartRename={handleStartRename} onSaveRename={handleSaveRename} onCancelRename={handleCancelRename} onRenameValueChange={setRenameValue} onTogglePin={onTogglePin} onDeleteClick={setDeleteConfirmId} formatTime={formatLastUpdated} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-150 dark:border-zinc-800/50 flex flex-col gap-2.5 shrink-0">
              {chats.length > 0 && activeChatId && (
                <div className="px-3 py-2 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-800/70 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-400 dark:text-zinc-650 uppercase tracking-wider font-bold">Node:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold max-w-[120px] truncate">{chats.find(c => c.id === activeChatId)?.model || 'Default'}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="button" onClick={onOpenDashboard} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-xs font-semibold transition cursor-pointer" id="open-providers-dashboard"><Settings size={14} className="text-zinc-400 dark:text-zinc-550" /> Providers Central</button>
                <button type="button" onClick={onToggleTheme} className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-450 transition cursor-pointer" title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} id="theme-switcher-expanded">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full w-[68px] items-center shrink-0">
            <div className="p-4.5 border-b border-zinc-150 dark:border-zinc-800/50 w-full flex justify-center hover:bg-zinc-55/40 dark:hover:bg-zinc-950/20 transition cursor-pointer">
              <button type="button" onClick={onToggle} className="group flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-black cursor-pointer shadow-md shadow-emerald-500/10 hover:bg-emerald-400 hover:scale-105 active:scale-95 transition" title="Expand sidebar (Ctrl+\)" id="collapsed-app-logo"><span className="group-hover:hidden font-mono font-extrabold text-xs tracking-tighter">1R</span><PanelLeftOpen size={16} className="hidden group-hover:block" /></button>
            </div>
            <div className="p-3.5 flex flex-col gap-3.5 items-center w-full shrink-0">
              <button type="button" onClick={() => onNewChat(false)} className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-white dark:text-zinc-350 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-900 cursor-pointer shadow-sm shadow-black/5 hover:scale-105 transition" title="New Chat" id="btn-collapsed-new-chat"><Plus size={16} className="text-emerald-500" /></button>
              <button type="button" onClick={onToggle} className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/40 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer hover:scale-105 transition" title="Search Chats" id="btn-collapsed-search"><Search size={14} /></button>
            </div>
            <div className="flex-1" />
            <div className="p-3.5 border-t border-zinc-150 dark:border-zinc-800/50 flex flex-col gap-3.5 items-center w-full shrink-0">
              <button type="button" onClick={onOpenDashboard} className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer hover:scale-105 transition" title="Providers Central" id="collapsed-providers-trigger"><Settings size={15} /></button>
              <button type="button" onClick={onToggleTheme} className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-450 flex items-center justify-center cursor-pointer hover:scale-105 transition" title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} id="theme-switcher-collapsed">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
              <button type="button" onClick={onToggle} className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition mt-1.5 cursor-pointer hidden md:block" title="Expand sidebar" id="collapsed-expand-chevron"><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </motion.div>

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) onDeleteChat(deleteConfirmId); }}
        title="Delete Thread"
        message="Are you sure you want to delete this chat? This action cannot be undone and all messages will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
