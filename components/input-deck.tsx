'use client';

import * as React from 'react';
import {
  Plus, X, Image as ImageIcon, FileText, CornerDownLeft, Check, RefreshCw,
} from 'lucide-react';
import type { Attachment } from '../lib/provider-types';

interface InputDeckProps {
  inputText: string;
  setInputText: (val: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onStopStreaming: () => void;
  onEnhance: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  isStreaming: boolean;
  enhancing: boolean;
  enhancedPreview: string | null;
  originalPrompt: string;
  onApplyEnhanced: () => void;
  onDiscardEnhanced: () => void;
  onRevertOriginal: () => void;
  activeModel: string;
  // Upload
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  uploadMenuRef: React.RefObject<HTMLDivElement | null>;
  showUploadMenu: boolean;
  setShowUploadMenu: (val: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getFileIcon: (name: string, type: string) => React.ReactNode;
}

export function InputDeck({
  inputText, setInputText, attachments, onRemoveAttachment,
  onSend, onStopStreaming, onEnhance, onPaste,
  isStreaming, enhancing, enhancedPreview, originalPrompt,
  onApplyEnhanced, onDiscardEnhanced, onRevertOriginal,
  activeModel,
  fileInputRef, imageInputRef, uploadMenuRef,
  showUploadMenu, setShowUploadMenu, onFileUpload, getFileIcon,
}: InputDeckProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [inputText]);

  return (
    <div
      className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col p-2.5 text-left w-[42rem] mx-auto mb-8"
      onClick={(e) => e.stopPropagation()}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 font-mono text-[11px]">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 p-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 text-xs text-zinc-600 dark:text-zinc-300 font-semibold animate-fade-in"
            >
              {att.type.startsWith('image/') ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-8 h-8 object-cover rounded-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                getFileIcon(att.name, att.type)
              )}
              <span className="max-w-[100px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-850 text-zinc-400 hover:text-red-500 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
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
              onSend();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              if (originalPrompt) {
                e.preventDefault();
                onRevertOriginal();
              }
            }
          }}
          onPaste={onPaste}
          placeholder={`Send a package to ${activeModel || 'playground'}... (Shift+Enter for multi-line)`}
          rows={1}
          className="w-full bg-transparent border-0 outline-none focus:ring-0 text-sm p-3 pr-12 text-gray-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none font-sans"
        />

        {inputText.trim() && (
          <button
            type="button"
            onClick={onEnhance}
            disabled={enhancing}
            className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition cursor-pointer flex items-center justify-center animate-fade-in shrink-0"
            title="Enhance prompt with AI (✨)"
            id="textarea-enhance-icon"
          >
            <span className="text-sm select-none leading-none">✨</span>
          </button>
        )}
      </div>

      {originalPrompt && !enhancedPreview && (
        <div className="flex items-center justify-between mx-2.5 mt-1.5 mb-1 px-3 py-1.5 bg-emerald-500/5 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl text-[11px] text-zinc-500 font-mono animate-fade-in animate-duration-150">
          <span className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-400">
            <span className="text-emerald-500 animate-pulse">✨</span>
            <span>Prompt enhanced. Want to revert?</span>
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
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>✨</span>
              <span>Optimized AI Prompt proposal</span>
            </span>
            <span className="text-[9px] text-zinc-400 lowercase font-mono">Provider-Independent</span>
          </div>

          <div className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-350 max-h-[140px] overflow-y-auto select-text font-serif bg-zinc-50/50 dark:bg-zinc-950/20 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-900 scrollbar-thin">
            {enhancedPreview}
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
              className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-emerald-500 dark:text-black font-extrabold hover:bg-zinc-900 dark:hover:bg-emerald-405 cursor-pointer transition flex items-center gap-1 text-[11px]"
            >
              <Check size={12} />
              <span>Use Enhanced Version</span>
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
            accept="image/*"
            multiple
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileUpload}
            className="hidden"
            accept="image/*,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.md,.pdf,.txt,.docx,.doc"
            multiple
          />
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 hover:bg-red-500/30 transition cursor-pointer"
              title="Stop response"
            >
              <div className="w-3.5 h-3.5 bg-red-500 rounded-xs"></div>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!inputText.trim() && attachments.length === 0}
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
