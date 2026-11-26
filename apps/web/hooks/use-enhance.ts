'use client';

import * as React from 'react';
import { enhancePrompt } from '../lib/api';

export function useEnhance(inputText: string, setInputText: (value: string) => void, providerId: string, model: string) {
  const [enhancing, setEnhancing] = React.useState(false);
  const [enhancedPreview, setEnhancedPreview] = React.useState('');
  const [originalPrompt, setOriginalPrompt] = React.useState('');
  const [enhanceError, setEnhanceError] = React.useState('');
  const controller = React.useRef<AbortController | null>(null);
  const latestInput = React.useRef(inputText);
  React.useEffect(() => { latestInput.current = inputText; }, [inputText]);
  React.useEffect(() => () => controller.current?.abort(), []);

  const triggerEnhance = async () => {
    if (!inputText.trim() || controller.current) return;
    const before = inputText;
    const request = new AbortController();
    controller.current = request;
    setEnhancing(true);
    setEnhanceError('');
    try {
      const data = await enhancePrompt(before, providerId, model, AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
      if (latestInput.current !== before) { setEnhanceError('The prompt changed. Enhance it again to preview the current version.'); return; }
      setOriginalPrompt(before);
      setEnhancedPreview(data.enhanced);
    } catch (error) {
      if (!request.signal.aborted) setEnhanceError(error instanceof Error ? error.message : 'Enhancement failed. Try again.');
    } finally { controller.current = null; setEnhancing(false); }
  };

  const applyEnhancedPrompt = () => {
    if (enhancedPreview) setInputText(enhancedPreview);
    setEnhancedPreview('');
  };
  const discardEnhancedPrompt = () => { setEnhancedPreview(''); setOriginalPrompt(''); setEnhanceError(''); };
  const undoEnhancedPrompt = () => { setInputText(originalPrompt); discardEnhancedPrompt(); };
  return { enhancing, enhancedPreview, originalPrompt, enhanceError, triggerEnhance, applyEnhancedPrompt, discardEnhancedPrompt, undoEnhancedPrompt };
}
