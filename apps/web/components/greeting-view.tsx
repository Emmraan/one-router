'use client';

import type { ReactNode } from 'react';
import { Welcome } from '@one-router/ui/workspace';

export function GreetingView({ renderInputDeck, onPresetPrompt }: {
  renderInputDeck: () => ReactNode; onPresetPrompt: (text: string) => void;
}) {
  return <Welcome onPrompt={onPresetPrompt}>{renderInputDeck()}</Welcome>;
}
