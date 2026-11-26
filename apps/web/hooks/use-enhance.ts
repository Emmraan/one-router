'use client';

import * as React from 'react';
import { enhancePrompt } from '../lib/api';

export function useEnhance(inputText: string, setInputText: (value: string) => void) {
  const [enhancing, setEnhancing] = React.useState(false);
  const [enhancedPreview, setEnhancedPreview] = React.useState('');
  const [originalPrompt, setOriginalPrompt] = React.useState('');

  const triggerEnhance = async () => {
    if (!inputText.trim() || enhancing) return;
    setEnhancing(true);
    setOriginalPrompt(inputText);
    try {
      const data = await enhancePrompt(inputText);
      setEnhancedPreview(data.enhanced || inputText);
    } catch (error) {
      console.error('Prompt enhancement failed:', error);
      setEnhancedPreview(inputText);
    } finally {
      setEnhancing(false);
    }
  };

  const applyEnhancedPrompt = () => {
    if (enhancedPreview) setInputText(enhancedPreview);
  };

  const discardEnhancedPrompt = () => {
    setEnhancedPreview('');
    setOriginalPrompt('');
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
