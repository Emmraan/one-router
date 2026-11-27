'use client';

import { Sparkles, Quote, Copy, Check } from 'lucide-react';

interface FloatingSelectionToolbarProps {
  selectedText: string;
  selectionPosition: { x: number; y: number } | null;
  onAsk: () => void;
  onQuote: () => void;
  onCopy: () => void;
  copied: boolean;
}

export function FloatingSelectionToolbar({ selectedText, selectionPosition, onAsk, onQuote, onCopy, copied }: FloatingSelectionToolbarProps) {
  if (!selectedText || !selectionPosition) return null;
  return <div role="toolbar" aria-label="Selected text" className="selection-toolbar" style={{ left: selectionPosition.x, top: selectionPosition.y }} onClick={(event) => event.stopPropagation()} id="floating-selection-toolbar">
    <button type="button" className="button" onClick={onAsk}><Sparkles size={14} />Ask</button>
    <button type="button" className="button" onClick={onQuote}><Quote size={14} />Quote</button>
    <button type="button" className="button" onClick={onCopy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>
  </div>;
}
