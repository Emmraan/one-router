'use client';

import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import type { Provider } from '../lib/provider-types';
import { ModelSelector } from './model-selector';

export function HeaderBar({ providers, activeModel, activeProviderId, onSelectModelAndProvider, onLogout, children }: {
  providers: Provider[]; activeModel: string; activeProviderId: string;
  onSelectModelAndProvider: (providerId: string, model: string) => void; onLogout: () => void; children?: ReactNode;
}) {
  return <header className="workspace-header"><ModelSelector providers={providers} activeModel={activeModel}
    activeProviderId={activeProviderId} onSelectModelAndProvider={onSelectModelAndProvider} />
    <div className="flex items-center gap-1">{children}<span className="mx-1 h-5 border-l border-[var(--border)]" />
      <button type="button" id="logout-button" onClick={onLogout} className="icon-button" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
    </div>
  </header>;
}
