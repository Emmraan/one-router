'use client';
import { Plus, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Provider, ProviderType, PROVIDER_DEFAULTS } from '../../lib/provider-types';

interface ProviderListProps {
  providers: Provider[]; onEdit: (provider: Provider) => void;
  onDiscover: (provider: Provider) => void; onDelete: (id: string) => void;
  onSetActive: (provider: Provider) => void; onAddPreset: (type: ProviderType) => void;
  discoveringId: string | null; discoveryError: string | null;
}
export function ProviderList({ providers, onEdit, onDiscover, onDelete, onSetActive, onAddPreset, discoveringId, discoveryError }: ProviderListProps) {
  return <div className="space-y-6">
    {discoveryError && <p role="alert" id="discovery-err-banner" className="error-notice">{discoveryError}</p>}
    {providers.length ? <ul className="divide-y divide-[var(--border)]">{providers.map((provider) => <li key={provider.id} className="py-4 first:pt-0"><div className="flex items-center gap-3">
      <input type="radio" name="default-provider" aria-label={`Use ${provider.name} by default`} checked={Boolean(provider.isActive)} onChange={() => onSetActive(provider)} /><div className="min-w-0 flex-1"><p className="font-semibold truncate">{provider.name}</p><p className="muted text-xs truncate mt-1">{provider.baseUrl}</p></div>
      <div className="flex shrink-0"><button className="icon-button" aria-label={`Edit ${provider.name}`} onClick={() => onEdit(provider)}><Pencil size={15} /></button><button className="icon-button" aria-label={`Discover models for ${provider.name}`} disabled={discoveringId === provider.id} onClick={() => onDiscover(provider)}><RefreshCw size={15} className={discoveringId === provider.id ? 'animate-spin' : ''} /></button><button className="icon-button" aria-label={`Delete ${provider.name}`} onClick={() => onDelete(provider.id)}><Trash2 size={15} /></button></div></div><p className="muted text-xs mt-3 ml-6 break-words">{provider.models.length} models{provider.models.length ? `: ${provider.models.slice(0, 4).join(', ')}${provider.models.length > 4 ? ', ...' : ''}` : ''}</p>
    </li>)}</ul> : <p className="muted leading-relaxed py-6">No providers yet. Add an endpoint or start with a preset below.</p>}
    <section className="border-t border-[var(--border)] pt-5"><h3 className="font-semibold">Start with a preset</h3><p className="muted text-xs mt-1 mb-3">Add your API key after choosing a provider.</p><div className="flex flex-col items-stretch">{(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((type) => <button key={type} className="flex items-center justify-between gap-4 text-left py-3 px-2 rounded hover:bg-[var(--hover)]" onClick={() => onAddPreset(type)}>{PROVIDER_DEFAULTS[type].name}<Plus size={15} /></button>)}</div></section>
  </div>;
}
