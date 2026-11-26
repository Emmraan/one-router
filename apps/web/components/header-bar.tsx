'use client';

import * as React from 'react';
import { LogOut } from 'lucide-react';
import { ModelSelector } from './model-selector';
import type { Provider } from '../lib/provider-types';

interface HeaderBarProps {
  providers: Provider[];
  activeModel: string;
  activeProviderId: string;
  onSelectModelAndProvider: (providerId: string, model: string) => void;
  onLogout: () => void;
}

export function HeaderBar({
  providers,
  activeModel,
  activeProviderId,
  onSelectModelAndProvider,
  onLogout,
}: HeaderBarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-50 transition-colors">
      <div className="flex items-center gap-3">
        <ModelSelector
          providers={providers}
          activeModel={activeModel}
          activeProviderId={activeProviderId}
          onSelectModelAndProvider={onSelectModelAndProvider}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          id="logout-button"
          title="Sign out"
        >
          <LogOut size={12} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}