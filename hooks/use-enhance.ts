'use client';

import * as React from 'react';

export function useEnhance(inputText: string, setInputText: (val: string) => void) {
  const [enhancing, setEnhancing] = React.useState(false);
  const [enhancedPreview, setEnhancedPreview] = React.useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = React.useState('');

  const triggerEnhance = async () => {
    if (!inputText.trim()) return;
    setEnhancing(true);
    setEnhancedPreview(null);
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputText }),
      });
      const data = await res.json();
      if (data.enhanced) {
        setEnhancedPreview(data.enhanced);
      }
    } catch (e) {
      console.error('Enhancer request failed', e);
    } finally {
      setEnhancing(false);
    }
  };

  const applyEnhancedPrompt = () => {
    if (enhancedPreview) {
      setOriginalPrompt(inputText);
      setInputText(enhancedPreview);
      setEnhancedPreview(null);
    }
  };

  const discardEnhancedPrompt = () => {
    setEnhancedPreview(null);
  };

  return {
    enhancing,
    enhancedPreview,
    originalPrompt,
    triggerEnhance,
    applyEnhancedPrompt,
    discardEnhancedPrompt,
  };
}
