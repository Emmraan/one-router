'use client';

import * as React from 'react';
import { Plus, X, Image as ImageIcon, FileText, CornerDownLeft, Check, RefreshCw, Sparkles } from 'lucide-react';
import type { Attachment } from '../lib/provider-types';

interface InputDeckProps {
  inputText: string;
  setInputText: (value: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onRetryAttachment: (id: string) => void;
  onSend: () => void;
  onStopStreaming: () => void;
  onEnhance: () => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  isStreaming: boolean;
  enhancing: boolean;
  enhancedPreview: string;
  originalPrompt: string;
  enhanceError: string;
  uploadError: string;
  onApplyEnhanced: () => void;
  onDiscardEnhanced: () => void;
  onRevertOriginal: () => void;
  activeModel: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  uploadMenuRef: React.RefObject<HTMLDivElement | null>;
  showUploadMenu: boolean;
  setShowUploadMenu: (value: boolean) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  getFileIcon: (name: string, type: string) => React.ReactNode;
}

export function InputDeck(props: InputDeckProps) {
  const { inputText, setInputText, attachments, isStreaming, originalPrompt, enhancedPreview, activeModel, fileInputRef, imageInputRef, uploadMenuRef } = props;
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const pending = attachments.some((item) => item.status === 'uploading');
  const canSend = Boolean(activeModel) && (Boolean(inputText.trim()) || attachments.some((item) => item.status === 'ready')) && !pending && !attachments.some((item) => item.status === 'error') && !isStreaming;
  React.useEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 200)}px`;
    field.style.overflowY = field.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [inputText]);
  const submit = () => { if (canSend) props.onSend(); };
  return <div className="composer" onClick={(event) => event.stopPropagation()}>
    {attachments.length > 0 && <div className="attachment-list">{attachments.map((item) => <div key={item.id} className="attachment-chip" data-error={item.status === 'error' || undefined}>
      {item.type.startsWith('image/') && item.status !== 'error' ? <img src={item.url} alt={item.name} className="w-8 h-8 object-cover rounded-sm" referrerPolicy="no-referrer" /> : props.getFileIcon(item.name, item.type)}
      <span className="min-w-0"><span className="block max-w-40 truncate">{item.name}</span>
        {item.status === 'uploading' && <progress value={item.progress ?? 0} max={100} aria-label={`Uploading ${item.name}`} />}
        {item.status === 'error' && <span className="attachment-error">{item.error ?? 'Upload failed.'}</span>}
      </span>
      {item.status === 'error' && <button type="button" className="icon-button" onClick={() => props.onRetryAttachment(item.id)} aria-label={`Retry ${item.name}`}><RefreshCw size={14} /></button>}
      <button type="button" className="icon-button" onClick={() => props.onRemoveAttachment(item.id)} aria-label={`Remove ${item.name}`}><X size={14} /></button>
    </div>)}</div>}
    {props.uploadError && <p role="alert" className="error-notice m-3">{props.uploadError}</p>}
    <div className="relative">
      <textarea ref={textarea} rows={1} value={inputText} onChange={(event) => setInputText(event.target.value)} onPaste={props.onPaste} maxLength={100000} aria-label="Message" placeholder={`Message ${activeModel || 'your model'}...`} className="!pr-14" onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && originalPrompt) { event.preventDefault(); props.onRevertOriginal(); }
      }} />
      {inputText.trim() && <button type="button" className="icon-button absolute right-3 top-3" id="textarea-enhance-icon" aria-label="Enhance prompt" title="Enhance prompt" disabled={props.enhancing || isStreaming} onClick={props.onEnhance}><Sparkles size={16} /></button>}
    </div>
    {props.enhanceError && <p role="alert" className="error-notice mx-3">{props.enhanceError}</p>}
    {originalPrompt && !enhancedPreview && <div className="status-notice mx-3 justify-between"><span>Prompt enhanced. Undo to restore the original.</span><button type="button" className="button" onClick={props.onRevertOriginal}>Undo (Ctrl+Z)</button></div>}
    {enhancedPreview && <div className="prompt-preview"><div className="flex justify-between gap-2"><strong>Prompt preview</strong><span className="muted truncate">{activeModel}</span></div><div className="grid gap-3 sm:grid-cols-2">
      <div><p className="muted mb-1">Before</p><div className="prompt-comparison">{originalPrompt}</div></div>
      <div><p className="muted mb-1">After</p><div className="prompt-comparison">{enhancedPreview}</div></div>
    </div><div className="flex justify-end gap-2"><button type="button" className="button" onClick={props.onDiscardEnhanced}>Discard</button><button type="button" className="button primary" onClick={props.onApplyEnhanced}><Check size={14} />Apply</button></div></div>}
    <div className="composer-toolbar justify-between">
      <div className="relative" ref={uploadMenuRef} onKeyDown={(event) => { if (event.key === 'Escape') { props.setShowUploadMenu(false); event.currentTarget.querySelector('button')?.focus(); } }}>
        <button type="button" className="icon-button" title="Attach files" aria-label="Attach files" aria-expanded={props.showUploadMenu} onClick={() => props.setShowUploadMenu(!props.showUploadMenu)}><Plus size={18} /></button>
        {props.showUploadMenu && <div className="attachment-menu"><button type="button" autoFocus className="button w-full" onClick={() => { imageInputRef.current?.click(); props.setShowUploadMenu(false); }}><ImageIcon size={16} />Upload image</button><button type="button" className="button w-full" onClick={() => { fileInputRef.current?.click(); props.setShowUploadMenu(false); }}><FileText size={16} />Upload file</button></div>}
        <input type="file" ref={imageInputRef} onChange={props.onFileUpload} className="hidden" accept="image/png,image/jpeg,image/gif,image/webp" multiple aria-label="Upload images" />
        <input type="file" ref={fileInputRef} onChange={props.onFileUpload} className="hidden" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,application/json,text/plain,text/markdown,text/csv,.md,.pdf,.txt,.csv,.json" multiple aria-label="Upload files" />
      </div>
      <div className="flex items-center gap-3"><span className="composer-hint">Shift + Enter for a new line</span>{pending && <span role="status" className="muted text-xs">Uploading...</span>}
        {isStreaming ? <button type="button" className="button danger" onClick={props.onStopStreaming} aria-label="Stop response"><span className="w-3 h-3 bg-current rounded-xs" />Stop</button> : <button type="button" className="button primary" disabled={!canSend} onClick={submit}>Submit<CornerDownLeft size={14} /></button>}
      </div>
    </div>
  </div>;
}
