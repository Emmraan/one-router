'use client';

import * as React from 'react';
import { Sparkles, Quote, Copy, Check } from 'lucide-react';

interface FloatingSelectionToolbarProps {
  selectedText: string;
  selectionPosition: { x: number; y: number } | null;
  onAsk: () => void;
  onQuote: () => void;
  onCopy: () => void;
  copied: boolean;
}

export function FloatingSelectionToolbar({
  selectedText,
  selectionPosition,
  onAsk,
  onQuote,
  onCopy,
  copied,
}: FloatingSelectionToolbarProps) {
  if (!selectedText || !selectionPosition) return null;

  return (
    <div
      className="absolute bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl shadow-xl flex items-center p-1.5 gap-1.5 z-50 animate-scale-up"
      style={{ left: selectionPosition.x, top: selectionPosition.y }}
      onClick={(e) => e.stopPropagation()}
      id="floating-selection-toolbar"
    >
      <button
        type="button"
        onClick={onAsk}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer"
        title="Ask AI about this highlighted passage"
      >
        <Sparkles size={13} className="text-emerald-500 animate-pulse" />
        <span>Ask</span>
      </button>
      <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />
      <button
        type="button"
        onClick={onQuote}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer"
        title="Quote selection as blockquote block"
      >
        <Quote size={13} className="text-indigo-500" />
        <span>Quote</span>
      </button>
      <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer"
        title="Copy selected snippet to clipboard"
      >
        {copied ? (
          <>
            <Check size={13} className="text-emerald-500" />
            <span className="text-emerald-500 font-extrabold">Copied!</span>
          </>
        ) : (
          <>
            <Copy size={13} className="text-zinc-400" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}
