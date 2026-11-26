'use client';

import * as React from 'react';
import {
  Plus, X, Image as ImageIcon, FileText, CornerDownLeft, Check, RefreshCw,
  Sparkles, AlertTriangle,
} from 'lucide-react';
import type { Attachment } from '../lib/provider-types';

interface InputDeckProps {
  inputText: string;
  setInputText: (val: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onRetryAttachment: (id: string) => void;
  onSend: () => void;
  onStopStreaming: () => void;
  onEnhance: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
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
  setShowUploadMenu: (val: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getFileIcon: (name: string, type: string) => React.ReactNode;
}

export function InputDeck({
  inputText, setInputText, attachments, onRemoveAttachment, onRetryAttachment,
  onSend, onStopStreaming, onEnhance, onPaste,
  isStreaming, enhancing, enhancedPreview, originalPrompt, enhanceError, uploadError,
  onApplyEnhanced, onDiscardEnhanced, onRevertOriginal,
  activeModel,
  fileInputRef, imageInputRef, uploadMenuRef,
  showUploadMenu, setShowUploadMenu, onFileUpload, getFileIcon,
}: InputDeckProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const hasPending = attachments.some((attachment) => attachment.status === 'uploading');
  const hasError = attachments.some((attachment) => attachment.status === 'error');
  const hasReady = attachments.some((attachment) => attachment.status === 'ready');
  const canSend = (Boolean(inputText.trim()) || hasReady) && !hasPending && !hasError && !isStreaming;

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [inputText]);

  const submit = () => {
    if (canSend) onSend();
  };

  return (
    <div
      className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col p-2.5 text-left w-[calc(100%-2rem)] max-w-[42rem] mx-auto mb-8"
      onClick={(e) => e.stopPropagation()}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 font-mono text-[11px]">
          {attachments.map((att) => (
            <div
              key={att.id}
              className={`flex items-center gap-1.5 p-1 rounded border text-xs text-zinc-600 dark:text-zinc-300 font-semibold animate-fade-in ${
                att.status === 'error'
                  ? 'border-red-300 bg-red-500/5 dark:border-red-900/60'
                  : 'border-zinc-200 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950'
              }`}
            >
              {att.type.startsWith('image/') && att.status !== 'error' ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-8 h-8 object-cover rounded-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                getFileIcon(att.name, att.type)
              )}
              <span className="min-w-0">
                <span className="block max-w-[100px] truncate">{att.name}</span>
                {att.status === 'uploading' && (
                  <span className="mt-0.5 block h-1 w-20 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                    <span className="block h-full bg-emerald-500 transition-[width]" style={{ width: `${att.progress ?? 0}%` }} />
                  </span>
                )}
                {att.status === 'error' && (
                  <span className="block max-w-[140px] truncate text-[9px] font-normal text-red-500">{att.error ?? 'Upload failed.'}</span>
                )}
              </span>
              {att.status === 'error' && (
                <button
                  type="button"
                  onClick={() => onRetryAttachment(att.id)}
                  className="p-0.5 rounded text-zinc-400 hover:text-emerald-500 cursor-pointer"
                  title="Retry upload"
                  aria-label={`Retry ${att.name}`}
                >
                  <RefreshCw size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-850 text-zinc-400 hover:text-red-500 cursor-pointer"
                aria-label={`Remove ${att.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <p role="alert" className="mx-3 mt-2 flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-600 dark:text-red-400">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          {uploadError}
        </p>
      )}

      <div className="relative flex items-center">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 200) + 'px';
            el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && originalPrompt) {
              e.preventDefault();
              onRevertOriginal();
            }
          }}
          onPaste={onPaste}
          maxLength={100000}
          aria-label="Message"
          placeholder={`Send a package to ${activeModel || 'playground'}... (Shift+Enter for multi-line)`}
          rows={1}
          className="w-full bg-transparent border-0 outline-none focus:ring-0 text-sm p-3 pr-12 text-gray-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none font-sans"
        />

        {inputText.trim() && (
          <button
            type="button"
            onClick={onEnhance}
            disabled={enhancing || isStreaming}
            className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition cursor-pointer flex items-center justify-center animate-fade-in shrink-0 disabled:opacity-40"
            title="Enhance prompt"
            aria-label="Enhance prompt"
            id="textarea-enhance-icon"
          >
            <Sparkles size={13} />
          </button>
        )}
      </div>

      {enhanceError && (
        <p role="alert" className="mx-3 mb-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-600 dark:text-red-400">
          {enhanceError}
        </p>
      )}

      {originalPrompt && !enhancedPreview && (
        <div className="flex items-center justify-between mx-2.5 mt-1.5 mb-1 px-3 py-1.5 bg-emerald-500/5 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl text-[11px] text-zinc-500 font-mono animate-fade-in">
          <span className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-400">
            <Sparkles size={11} className="text-emerald-500" />
            <span>Prompt enhanced. Undo to restore the original.</span>
          </span>
          <button
            type="button"
            onClick={onRevertOriginal}
            className="font-bold text-indigo-600 dark:text-emerald-450 hover:underline cursor-pointer"
          >
            Undo (Ctrl+Z)
          </button>
        </div>
      )}

      {enhancedPreview && (
        <div className="mx-2.5 my-2.5 p-3.5 bg-emerald-500/5 dark:bg-[#0c0c0c] border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex flex-col gap-2.5 animate-fade-in shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400">
              <Sparkles size={11} />
              <span>Prompt preview</span>
            </span>
            <span className="truncate text-[9px] text-zinc-400 lowercase font-mono">{activeModel || 'Selected model'}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Before</p>
              <div className="max-h-[120px] overflow-y-auto rounded-xl border border-zinc-150 bg-zinc-50/50 p-2.5 text-xs leading-relaxed text-zinc-600 select-text scrollbar-thin dark:border-zinc-900 dark:bg-zinc-950/20 dark:text-zinc-400">
                {originalPrompt}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">After</p>
              <div className="max-h-[120px] overflow-y-auto rounded-xl border border-emerald-500/20 bg-white p-2.5 text-xs leading-relaxed text-zinc-700 select-text scrollbar-thin dark:bg-zinc-950/40 dark:text-zinc-300">
                {enhancedPreview}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 text-xs pt-1">
            <button
              type="button"
              onClick={onDiscardEnhanced}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-bold cursor-pointer transition text-[11px]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onApplyEnhanced}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-emerald-500 dark:text-black font-extrabold hover:bg-zinc-900 dark:hover:bg-emerald-400 cursor-pointer transition flex items-center gap-1 text-[11px]"
            >
              <Check size={12} />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-3 border-t border-zinc-100 dark:border-zinc-800/60 pt-2.5 text-zinc-400">
        <div className="flex items-center gap-1.5 relative" ref={uploadMenuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowUploadMenu(!showUploadMenu); }}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-350 cursor-pointer transition"
            title="Attach files"
            aria-label="Attach files"
          >
            <Plus size={18} />
          </button>

          {showUploadMenu && (
            <div className="absolute bottom-full left-0 mb-3 -translate-x-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg rounded-xl p-1 min-w-[140px] z-[100] animate-fade-in">
              <button
                type="button"
                onClick={() => { imageInputRef.current?.click(); setShowUploadMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition cursor-pointer"
              >
                <ImageIcon size={14} className="text-indigo-500" />
                Upload Image
              </button>
              <button
                type="button"
                onClick={() => { fileInputRef.current?.click(); setShowUploadMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition cursor-pointer"
              >
                <FileText size={14} className="text-amber-500" />
                Upload File
              </button>
            </div>
          )}

          <input
            type="file"
            ref={imageInputRef}
            onChange={onFileUpload}
            className="hidden"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            aria-label="Upload images"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileUpload}
            className="hidden"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,application/json,text/plain,text/markdown,text/csv,.md,.pdf,.txt,.csv,.json"
            multiple
            aria-label="Upload files"
          />
        </div>

        <div className="flex items-center gap-2">
          {hasPending && <span className="text-[9px] font-mono text-zinc-400">Uploading...</span>}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 hover:bg-red-500/30 transition cursor-pointer"
              title="Stop response"
              aria-label="Stop response"
            >
              <div className="w-3.5 h-3.5 bg-red-500 rounded-xs"></div>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="h-8 px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-[#111111] dark:hover:bg-[#151515] lg:dark:bg-emerald-500 lg:dark:hover:bg-emerald-400 lg:dark:text-black text-white dark:text-zinc-200 text-xs font-bold border border-zinc-200 dark:border-zinc-800 transition flex items-center gap-1.5 disabled:opacity-45 cursor-pointer"
            >
              <span>Submit</span>
              <CornerDownLeft size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
