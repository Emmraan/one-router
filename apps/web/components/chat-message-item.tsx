'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check, Edit, Trash2, Quote, Download, RefreshCw } from 'lucide-react';
import { NetworkMark } from '@one-router/ui/brand';
import type { Message } from '../lib/provider-types';

const MarkdownRenderer = dynamic(() => import('./markdown-renderer').then((module) => module.MarkdownRenderer), {
  loading: () => <span className="muted">Loading message…</span>,
});

interface ChatMessageItemProps {
  message: Message; index: number; isEditingThis: boolean; editingMessageText: string;
  setEditingMessageText: (text: string) => void; cancelEditMessage: () => void;
  saveEditedMessage: (index: number, isUser: boolean) => void; activeModel: string;
  isStreaming: boolean; isLastBlock: boolean;
  handleTextSelect: (text: string, position: { x: number; y: number } | null) => void;
  handleEditMessage: (id: string, content: string) => void; deleteMessage: (id: string) => void;
  quoteMessage: (content: string) => void; handleRegenerate: (index: number) => void;
  exportMessageToMarkdown: (content: string, id: string) => void;
  getFileIcon: (name: string, type: string) => React.ReactNode;
  style?: React.CSSProperties; measureRef?: (element: HTMLElement | null) => void;
}

export const ChatMessageItem = React.memo(function ChatMessageItem(props: ChatMessageItemProps) {
  const { message, index, isEditingThis, editingMessageText, setEditingMessageText, cancelEditMessage,
    saveEditedMessage, activeModel, isStreaming, isLastBlock, handleTextSelect, handleEditMessage,
    deleteMessage, quoteMessage, handleRegenerate, exportMessageToMarkdown, getFileIcon, style, measureRef } = props;
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (textarea.current) { textarea.current.style.height = 'auto'; textarea.current.style.height = `${textarea.current.scrollHeight}px`; }
  }, [isEditingThis, editingMessageText]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Could not copy. Select the message and copy it manually.'); }
  };
  return <div ref={measureRef} data-index={index} style={style} className={`message-row ${isUser ? 'user' : 'assistant'}`}>
    {!isUser && <div className="message-avatar"><NetworkMark width={28} height={28} /></div>}
    <div className="message-body">
      <div className="message-meta"><span>{isUser ? 'You' : message.model || activeModel}</span><time dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
      <div className="message-content">
        {!!message.attachments?.length && <div className="message-attachments">{message.attachments.map((attachment) => <div key={attachment.id} className="message-attachment">
          {attachment.type.startsWith('image/') ? <img src={attachment.url} alt={attachment.name} loading="lazy" /> : getFileIcon(attachment.name, attachment.type)}<span className="truncate">{attachment.name}</span>
        </div>)}</div>}
        {isEditingThis ? <textarea ref={textarea} aria-label="Edit message" className="field w-full resize-none" autoFocus rows={2}
          value={editingMessageText} onChange={(event) => setEditingMessageText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveEditedMessage(index, isUser); }
            if (event.key === 'Escape') { event.preventDefault(); cancelEditMessage(); }
          }} /> : <MarkdownRenderer content={message.content} onTextSelect={isUser ? undefined : handleTextSelect} isStreaming={isLastBlock && isStreaming && !isUser} />}
      </div>
      {isEditingThis ? <div className="flex items-center gap-2 mt-2"><button className="button primary" onClick={() => saveEditedMessage(index, isUser)}>{isUser ? 'Send' : 'Save'}</button><button className="button" onClick={cancelEditMessage}>Cancel</button><span className="muted text-xs">Ctrl+Enter to save · Esc to cancel</span></div>
        : <div className="message-actions" aria-label={isUser ? 'Your message actions' : 'Response actions'}>
          {isUser && <button className="button" onClick={() => handleEditMessage(message.id, message.content)}><Edit size={12} />Edit</button>}
          <button className="button" onClick={copy}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button>
          {isUser ? <button className="button" onClick={() => deleteMessage(message.id)}><Trash2 size={12} />Delete</button> : <>
            <button className="button" onClick={() => quoteMessage(message.content)}><Quote size={12} />Quote</button>
            <button className="button" onClick={() => handleRegenerate(index)} disabled={isStreaming}><RefreshCw size={12} />Regenerate</button>
            <button className="button" onClick={() => exportMessageToMarkdown(message.content, message.id)}><Download size={12} />Export</button>
          </>}
        </div>}
      {error && <p role="alert" className="error-notice">{error}</p>}
    </div>
  </div>;
});
