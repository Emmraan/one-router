'use client';

import * as React from 'react';
import { 
  MessageSquare, Plus, Trash2, Edit2, Settings, Moon, Sun, 
  X, Check, ChevronLeft, ChevronRight, Pin, Search, PanelLeftOpen 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from '../lib/provider-types';
import { ConfirmModal } from './confirm-modal';

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

// Relative times reporter helper
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
  isOpen,
  onToggle,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenDashboard,
  theme,
  onToggleTheme,
  isTempMode,
  onTogglePin,
}: SidebarProps) {
  const [editingChatId, setEditingChatId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  // Check and keep updated responsive breakpoints state
  React.useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const handleStartRename = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setRenameValue(chat.title);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (renameValue.trim()) {
      onRenameChat(id, renameValue.trim());
    }
    setEditingChatId(null);
  };

  const handleCancelRename = () => {
    setEditingChatId(null);
  };

  const handleSelectChat = (id: string) => {
    onSelectChat(id);
    if (isMobile) {
      onToggle(); // Close sidebar drawer on mobile for seamless navigation
    }
  };

  // Chats filtering based on real-time lookup query (exclude temporary chats, search title + message content)
  const filteredChats = chats.filter((chat) => {
    // Hide uncommitted non-temp chats (still waiting for first response)
    if (!chat.isTemporary && !chat.committed) return false;
    const q = searchQuery.toLowerCase();
    if (chat.title.toLowerCase().includes(q)) return true;
    return chat.messages?.some((m) => m.content?.toLowerCase().includes(q));
  });

  const pinnedChats = filteredChats.filter((chat) => chat.isPinned);
  const unpinnedChats = filteredChats.filter((chat) => !chat.isPinned);

  // Define sidebar variants matching Drawer + Collapsible animations
  const sidebarVariants = {
    open: {
      width: isMobile ? 288 : 288,
      x: 0,
      transition: { type: 'spring' as const, stiffness: 260, damping: 28 },
    },
    collapsed: {
      width: isMobile ? 0 : 68,
      x: isMobile ? -288 : 0,
      transition: { type: 'spring' as const, stiffness: 260, damping: 28 },
    },
  };

  return (
    <>
      {/* Mobile Drawer Backdrop overlay */}
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 z-40 bg-zinc-950 backdrop-blur-xs md:hidden"
            id="mobile-drawer-overlay"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Layout Core Frame */}
      <motion.div
        initial={false}
        animate={isOpen ? 'open' : 'collapsed'}
        variants={sidebarVariants}
        className={`fixed md:relative top-0 left-0 h-full z-45 flex flex-col bg-white dark:bg-[#0d0d0d] border-r border-zinc-200 dark:border-zinc-800/60 text-gray-900 dark:text-zinc-300 overflow-hidden shadow-2xl md:shadow-none select-none`}
        id="onerouter-sidebar-shell"
      >
        {/* Expanded View Content */}
        {isOpen ? (
          <div className="flex flex-col h-full w-72 shrink-0">
            {/* Expanded Header */}
            <div className="flex items-center justify-between p-4.5 border-b border-zinc-150 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-emerald-500 text-black font-mono font-bold text-xs tracking-tighter">
                  1R
                </div>
                <div>
                  <span className="font-bold text-[14px] tracking-tight text-zinc-950 dark:text-white">ONE ROUTER</span>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-650 font-bold uppercase tracking-wider">HYPER-ROUTING v1.0.4</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Collapse button for Desktop */}
                <button
                  type="button"
                  onClick={onToggle}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-450 cursor-pointer hidden md:block"
                  title="Collapse sidebar (Ctrl+\)"
                  id="collapse-sidebar-chevron"
                >
                  <ChevronLeft size={14} />
                </button>
                {/* Close Drawer button for Mobile */}
                <button
                  type="button"
                  onClick={onToggle}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-450 cursor-pointer md:hidden"
                  id="close-mobile-drawer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Quick Action controls */}
            <div className="p-4 flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNewChat(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/50 text-white dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold shadow-xs transition cursor-pointer"
                id="btn-new-chat"
              >
                <Plus size={15} className="text-emerald-500" /> New Chat
              </button>
            </div>

            {/* Real-time search engine */}
            <div className="px-4 pb-3 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-650" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/85 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all font-medium"
                  id="search-chats-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-500 rounded cursor-pointer transition"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Chat Lists Streamer Container */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-4 scrollbar-thin">
              
              {/* Pinned Section */}
              {pinnedChats.length > 0 && (
                <div>
                  <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">
                    <span className="flex items-center gap-1">
                      <Pin size={10} className="fill-current text-emerald-500 rotate-45" /> Pinned
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 tracking-normal font-bold">
                      {pinnedChats.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {pinnedChats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => !editingChatId && handleSelectChat(chat.id)}
                        className={`group relative flex flex-col justify-between px-3 py-2.5 rounded-xl text-xs transition border border-transparent cursor-pointer select-none ${
                          activeChatId === chat.id
                            ? 'bg-zinc-100 dark:bg-zinc-900/70 text-zinc-950 dark:text-zinc-100 border-zinc-200/50 dark:border-zinc-800/60 font-semibold'
                            : 'text-zinc-750 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 hover:bg-zinc-100/40 dark:hover:bg-zinc-900/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-6">
                          <MessageSquare size={13} className={activeChatId === chat.id ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-700'} />
                          {editingChatId === chat.id ? (
                            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="flex-1 bg-zinc-200/50 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1.5 py-0.5 text-xs text-zinc-900 dark:text-white font-medium"
                              />
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Cancel"
                              >
                                <X size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveRename(chat.id)}
                                className="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Save"
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="truncate flex-1 font-semibold text-zinc-850 dark:text-zinc-100">
                              {chat.title}
                            </span>
                          )}
                        </div>

                        {/* Relative Timestamp and Badges */}
                        {editingChatId !== chat.id && (
                          <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400 dark:text-zinc-650 font-semibold">
                            <span>{formatLastUpdated(chat.updatedAt || chat.createdAt)}</span>
                            <div className="flex items-center gap-1 text-[9px] font-bold">
                              {chat.isTemporary && (
                                <span className="px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded uppercase tracking-wide">
                                  Temp
                                </span>
                              )}
                              <Pin size={8} className="fill-current text-emerald-500 shrink-0" />
                            </div>
                          </div>
                        )}

                        {/* Action buttons list */}
                        {editingChatId !== chat.id && (
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center bg-white dark:bg-[#0d0d0d] rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl py-0.5 px-1 gap-0.5 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(chat.id);
                              }}
                              className="p-1 rounded text-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              title="Unpin Thread"
                            >
                              <Pin size={10} className="fill-current" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(chat, e)}
                              className="p-1 rounded text-zinc-450 hover:text-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              title="Rename Thread"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(chat.id);
                              }}
                              className="p-1 rounded text-zinc-450 hover:text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              title="Delete Thread"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Active History list */}
              <div>
                <p className="px-3 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1.5">
                  Recent Threads
                </p>

                {unpinnedChats.length === 0 && pinnedChats.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 dark:text-zinc-600">
                    <MessageSquare size={18} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                    <p className="text-[11px] font-semibold">No recorded nodes</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {unpinnedChats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => !editingChatId && handleSelectChat(chat.id)}
                        className={`group relative flex flex-col justify-between px-3 py-2.5 rounded-xl text-xs transition border border-transparent cursor-pointer select-none ${
                          activeChatId === chat.id
                            ? 'bg-zinc-100 dark:bg-zinc-900/70 text-zinc-950 dark:text-zinc-100 border-zinc-200/50 dark:border-zinc-800/60 font-semibold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-150/40 dark:hover:bg-zinc-900/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-6">
                          <MessageSquare size={13} className={activeChatId === chat.id ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-700'} />
                          {editingChatId === chat.id ? (
                            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="flex-1 bg-zinc-200/50 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1.5 py-0.5 text-xs text-zinc-900 dark:text-white font-medium"
                              />
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Cancel"
                              >
                                <X size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveRename(chat.id)}
                                className="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Save"
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="truncate flex-1 font-semibold text-zinc-800 dark:text-zinc-100">
                              {chat.title}
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        {editingChatId !== chat.id && (
                          <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400 dark:text-zinc-600 font-semibold">
                            <span>{formatLastUpdated(chat.updatedAt || chat.createdAt)}</span>
                            {chat.isTemporary && (
                              <span className="text-[8px] px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded uppercase font-bold tracking-wide">
                                Temp
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action buttons list */}
                        {editingChatId !== chat.id && (
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center bg-white dark:bg-[#0d0d0d] rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl py-0.5 px-1 gap-0.5 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(chat.id);
                              }}
                              className="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              title="Pin Thread"
                            >
                              <Pin size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(chat, e)}
                              className="p-1 rounded text-zinc-450 hover:text-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              title="Rename Thread"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(chat.id);
                              }}
                              className="p-1 rounded text-zinc-450 hover:text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              title="Delete Thread"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Config Panel */}
            <div className="p-4 border-t border-zinc-150 dark:border-zinc-800/50 flex flex-col gap-2.5 shrink-0">
              {chats.length > 0 && activeChatId && (
                <div className="px-3 py-2 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-800/70 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-400 dark:text-zinc-650 uppercase tracking-wider font-bold">Node:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold max-w-[120px] truncate">
                    {chats.find(c => c.id === activeChatId)?.model || 'Default'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-xs font-semibold transition cursor-pointer"
                  id="open-providers-dashboard"
                >
                  <Settings size={14} className="text-zinc-400 dark:text-zinc-550" /> Providers Central
                </button>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-450 transition cursor-pointer"
                  title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                  id="theme-switcher-expanded"
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Collapsed View icon-only rail (width 68) */
          <div className="flex flex-col h-full w-[68px] items-center shrink-0">
            {/* Logo, serving as expand triggers */}
            <div className="p-4.5 border-b border-zinc-150 dark:border-zinc-800/50 w-full flex justify-center hover:bg-zinc-55/40 dark:hover:bg-zinc-950/20 transition cursor-pointer">
              <button
                type="button"
                onClick={onToggle}
                className="group flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-black cursor-pointer shadow-md shadow-emerald-500/10 hover:bg-emerald-400 hover:scale-105 active:scale-95 transition"
                title="Expand sidebar (Ctrl+\)"
                id="collapsed-app-logo"
              >
                <span className="group-hover:hidden font-mono font-extrabold text-xs tracking-tighter">1R</span>
                <PanelLeftOpen size={16} className="hidden group-hover:block" />
              </button>
            </div>

            {/* Compact Action buttons */}
            <div className="p-3.5 flex flex-col gap-3.5 items-center w-full shrink-0">
              <button
                type="button"
                onClick={() => onNewChat(false)}
                className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-white dark:text-zinc-350 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-900 cursor-pointer shadow-sm shadow-black/5 hover:scale-105 transition"
                title="New Chat"
                id="btn-collapsed-new-chat"
              >
                <Plus size={16} className="text-emerald-500" />
              </button>

              {/* Collapsed Search Trigger */}
              <button
                type="button"
                onClick={onToggle}
                className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/40 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer hover:scale-105 transition"
                title="Search Chats"
                id="btn-collapsed-search"
              >
                <Search size={14} />
              </button>
            </div>

            {/* Spacer filling the removed history list area */}
            <div className="flex-1" />

            {/* Collapsed Bottom Action triggers */}
            <div className="p-3.5 border-t border-zinc-150 dark:border-zinc-800/50 flex flex-col gap-3.5 items-center w-full shrink-0">
              <button
                type="button"
                onClick={onOpenDashboard}
                className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer hover:scale-105 transition"
                title="Providers Central"
                id="collapsed-providers-trigger"
              >
                <Settings size={15} />
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/60 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-450 flex items-center justify-center cursor-pointer hover:scale-105 transition"
                title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                id="theme-switcher-collapsed"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Quick expand toggler anchor chevrons at absolute bottom */}
              <button
                type="button"
                onClick={onToggle}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition mt-1.5 cursor-pointer hidden md:block"
                title="Expand sidebar"
                id="collapsed-expand-chevron"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            onDeleteChat(deleteConfirmId);
          }
        }}
        title="Delete Thread"
        message="Are you sure you want to delete this chat? This action cannot be undone and all messages will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
