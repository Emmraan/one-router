'use client';

import * as React from 'react';

export function useTextSelection() {
  const [selectedText, setSelectedText] = React.useState('');
  const [selectionPosition, setSelectionPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [copiedSelection, setCopiedSelection] = React.useState(false);

  const handleTextSelect = (text: string, position: { x: number; y: number } | null) => {
    setSelectedText(text);
    setSelectionPosition(position);
  };

  const triggerCopySelection = () => {
    if (!selectedText) return;
    navigator.clipboard.writeText(selectedText);
    setCopiedSelection(true);
    setTimeout(() => {
      setCopiedSelection(false);
      setSelectedText('');
      setSelectionPosition(null);
    }, 1000);
  };

  React.useEffect(() => {
    const handleDocumentClick = () => {
      setSelectedText('');
      setSelectionPosition(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  return {
    selectedText,
    selectionPosition,
    copiedSelection,
    handleTextSelect,
    triggerCopySelection,
  };
}
