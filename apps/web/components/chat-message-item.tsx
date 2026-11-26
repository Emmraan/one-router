'use client';

import * as React from 'react';
import {
  Copy, Check, Edit, Trash2, Quote, Download, RefreshCw
} from 'lucide-react';
import { MarkdownRenderer } from './markdown-renderer';
import { Message, Attachment } from '../lib/provider-types';

interface ChatMessageItemProps {
  message: Message;
  index: number;
  isEditingThis: boolean;
  editingMessageText: string;
  setEditingMessageText: (s: string) => void;
  cancelEditMessage: () => void;
  saveEditedMessage: (idx: number, isUser: boolean) => void;
  activeModel: string;
  isStreaming: boolean;
  isLastBlock: boolean;
  handleTextSelect: (text: string, position: { x: number; y: number } | null) => void;
  handleEditMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  quoteMessage: (content: string) => void;
  handleRegenerate: (idx: number) => void;
  exportMessageToMarkdown: (content: string, id: string) => void;
  getFileIcon: (name: string, type: string) => React.ReactNode;
  style?: React.CSSProperties;
  measureRef?: (el: HTMLElement | null) => void;
}

export const ChatMessageItem = React.memo(function ChatMessageItem({
  message,
  index,
  isEditingThis,
  editingMessageText,
  setEditingMessageText,
  cancelEditMessage,
  saveEditedMessage,
  activeModel,
  isStreaming,
  isLastBlock,
  handleTextSelect,
  handleEditMessage,
  deleteMessage,
  quoteMessage,
  handleRegenerate,
  exportMessageToMarkdown,
  getFileIcon,
  style,
  measureRef,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const [localCopied, setLocalCopied] = React.useState(false);
  const editTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const outerDivRef = React.useRef<HTMLDivElement>(null);

  const combinedRef = React.useCallback((el: HTMLDivElement | null) => {
    outerDivRef.current = el;
    if (measureRef) {
      measureRef(el);
    }
  }, [measureRef]);

  React.useEffect(() => {
    if (isEditingThis && editTextareaRef.current) {
      const el = editTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [isEditingThis, editingMessageText]);

  const handleLocalCopy = React.useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setLocalCopied(true);
    setTimeout(() => {
      setLocalCopied(false);
    }, 2000);
  }, [message.content]);

  return (
    <div
      ref={combinedRef}
      data-index={index}
      style={{ ...style, zIndex: isEditingThis ? 20 : undefined }}
      className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} ${isEditingThis ? 'pb-18' : isUser ? 'pb-12' : 'pb-8'}`}
    >
      {/* Avatar Node */}
      {!isUser && (
        <div className="w-8 h-8 rounded bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <div className="w-3.5 h-3.5 bg-emerald-500 rounded-xs"></div>
        </div>
      )}

      <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Title label details */}
        <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 dark:text-zinc-500 font-medium font-mono">
          <span>{isUser ? 'YOU' : (message.model || activeModel)}</span>
          <span>•</span>
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Content Container balloon */}
        <div 
          className={`group relative p-4 rounded-2xl text-[14.5px] border transition ${
            isEditingThis ? 'z-10 shadow-lg' : ''
          } ${
            isEditingThis && isUser ? 'w-[46rem]' : ''
          } ${
            isUser 
              ? 'max-w-[560px] bg-zinc-900 hover:bg-zinc-850 dark:bg-[#111111] dark:hover:bg-[#151515] border-zinc-800 dark:border-zinc-800/80 text-white dark:text-zinc-200 shadow-xs' 
              : 'break-words bg-white hover:bg-zinc-50/50 dark:bg-transparent dark:hover:bg-transparent border-zinc-200 dark:border-transparent text-gray-900 dark:text-zinc-300'
          }`}
        >
          {/* Rich attachment rendering inside user message balloon */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att) => (
                <div 
                  key={att.id} 
                  className="flex items-center gap-1.5 p-1.5 rounded-lg border bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-600 dark:text-zinc-300 font-medium border-zinc-200 dark:border-zinc-800"
                >
                  {att.type.startsWith('image/') ? (
                    <img 
                      src={att.base64 ? `data:${att.type};base64,${att.base64}` : att.url} 
                      alt={att.name} 
                      className="w-10 h-10 object-cover rounded-md shadow-xs animate-fade-in" 
                    />
                  ) : (
                    getFileIcon(att.name, att.type)
                  )}
                  <span className="max-w-[120px] truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {isEditingThis ? (
            <textarea
              ref={editTextareaRef}
              value={editingMessageText}
              onChange={(e) => setEditingMessageText(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  saveEditedMessage(index, isUser);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEditMessage();
                }
              }}
              className="w-full bg-transparent border-0 outline-none text-[14.5px] leading-relaxed p-0 m-0 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
              style={{ height: 'auto', minHeight: '1.5em' }}
              rows={1}
              autoFocus
            />
          ) : (
            <MarkdownRenderer 
              content={message.content} 
              onTextSelect={!isUser ? handleTextSelect : undefined}
              isStreaming={isLastBlock && isStreaming && !isUser}
            />
          )}

          {/* Action controls toggled on hover of message card wrapper */}
          {!isEditingThis && (
            <div className={`absolute ${isUser ? '-bottom-8' : '-bottom-6'} ${isUser ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-md rounded-lg p-0.5 transition z-10 animate-fade-in`}>
              {isUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleEditMessage(message.id, message.content)}
                    className="p-1 px-1.5 text-[10px] text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 font-bold flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                    title="Edit user message and fork thread"
                  >
                    <Edit size={11} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleLocalCopy}
                    className="p-1 px-1.5 text-[10px] text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 font-bold flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                    title="Copy content to Clipboard"
                  >
                    {localCopied ? (
                      <>
                        <Check size={11} className="text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={11} /> Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMessage(message.id)}
                    className="p-1 px-1.5 text-[10px] text-red-500 hover:text-red-650 dark:hover:text-red-400 font-bold flex items-center gap-1 rounded hover:bg-red-50 dark:hover:bg-red-950/35 cursor-pointer"
                    title="Delete user message"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleLocalCopy}
                    className="p-1 px-1.5 text-[10px] text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 font-bold flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                    title="Copy content to Clipboard"
                  >
                    {localCopied ? (
                      <>
                        <Check size={11} className="text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={11} /> Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => quoteMessage(message.content)}
                    className="p-1 px-1.5 text-[10px] text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 font-bold flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                    title="Insert as blockquote block"
                  >
                    <Quote size={11} /> Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRegenerate(index)}
                    disabled={isStreaming}
                    className="p-1 px-1.5 text-[10px] text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 font-bold flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 cursor-pointer"
                    title="Regenerate response"
                  >
                    <RefreshCw size={11} className={isStreaming ? 'animate-spin' : ''} /> Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => exportMessageToMarkdown(message.content, message.id)}
                    className="p-1 px-1.5 text-[10px] text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 font-bold flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                    title="Export message as Markdown"
                  >
                    <Download size={11} /> Export
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Edit action buttons - outside balloon */}
        {isEditingThis && (
          <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => saveEditedMessage(index, isUser)}
              className="px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-zinc-950 transition cursor-pointer shadow-sm"
            >
              {isUser ? 'Send' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEditMessage}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono ml-1">
              Ctrl+Enter · Esc
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
