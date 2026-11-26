'use client';

import * as React from 'react';
import { Plus, Database, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { Provider, ProviderType, PROVIDER_DEFAULTS } from '../../lib/provider-types';

interface ProviderListProps {
  providers: Provider[];
  onUpdateProviders: (providers: Provider[]) => void;
  onEdit: (provider: Provider) => void;
  onDiscover: (provider: Provider) => void;
  onDelete: (id: string) => void;
  discoveringId: string | null;
  discoveryError: string | null;
}

export function ProviderList({
  providers, onUpdateProviders, onEdit, onDiscover, onDelete,
  discoveringId, discoveryError,
}: ProviderListProps) {
  const toggleActive = (id: string) => {
    const updated = providers.map((p) => ({ ...p, isActive: p.id === id }));
    onUpdateProviders(updated);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-zinc-300/40 dark:border-zinc-700/30 pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Connected Engine Groups</span>
      </div>

      {discoveryError && (
        <div id="discovery-err-banner" className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
          {discoveryError}
        </div>
      )}

      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/30 dark:bg-zinc-950/10">
          <Database size={24} className="text-zinc-300 dark:text-zinc-700 mb-2" />
          <p className="text-[11px] text-zinc-450 dark:text-zinc-550 text-center max-w-[280px] leading-relaxed">
            No custom endpoints active. Build a custom provider container, or run presets.
          </p>
          <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[240px]">
            {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const defaults = PROVIDER_DEFAULTS[type];
                  const newP: Provider = {
                    id: Math.random().toString(36).substring(7),
                    name: defaults.name,
                    type,
                    baseUrl: defaults.baseUrl,
                    apiKey: '',
                    models: defaults.models,
                    isActive: providers.length === 0,
                  };
                  onUpdateProviders([...providers, newP]);
                }}
                className="text-[10px] font-bold text-left px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
              >
                + Populate Preset {PROVIDER_DEFAULTS[type].name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((prov) => (
            <div
              key={prov.id}
              className={`p-3.5 rounded-xl border transition ${
                prov.isActive
                  ? 'bg-emerald-500/5 dark:bg-[#0c0c0c] border-emerald-500/60 shadow-xs'
                  : 'bg-white dark:bg-[#0c0c0c]/40 border-zinc-300/40 dark:border-zinc-700/30'
              }`}
            >
              <div className="flex items-start justify-between min-w-0 gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={prov.isActive}
                    onChange={() => toggleActive(prov.id)}
                    className="rounded text-emerald-500 accent-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer mt-1"
                    title="Set Active Engine Group"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold flex items-center flex-wrap gap-1.5">
                      <span>{prov.name}</span>
                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/80 text-zinc-500 font-mono uppercase font-bold">{prov.type}</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-[200px] md:max-w-[320px]">{prov.baseUrl}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => onEdit(prov)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-emerald-500 transition" title="Edit parameters"><Edit size={13} /></button>
                  <button type="button" onClick={() => onDiscover(prov)} disabled={discoveringId === prov.id} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-emerald-500 hover:text-emerald-400 disabled:opacity-50 transition cursor-pointer" title="Discover target models"><RefreshCw size={13} className={discoveringId === prov.id ? 'animate-spin' : ''} /></button>
                  <button type="button" onClick={() => onDelete(prov.id)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#1f1111] text-zinc-400 hover:text-red-500 transition" title="Delete provider"><Trash2 size={13} /></button>
                </div>
              </div>

              <div className="mt-2.5 pl-6.5 flex flex-wrap gap-1">
                {prov.models.slice(0, 6).map((m: string) => (
                  <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-150/80 dark:bg-zinc-900/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">{m}</span>
                ))}
                {prov.models.length > 6 && <span className="text-[9px] px-1.5 py-0.5 text-zinc-405 font-mono">+{prov.models.length - 6} more</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {providers.length > 0 && (
        <div className="pt-4 border-t border-zinc-300/40 dark:border-zinc-700/30">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-2 font-mono">Add Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[])
              .filter(type => !providers.some(p => p.type === type))
              .map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const defaults = PROVIDER_DEFAULTS[type];
                    const newP: Provider = {
                      id: Math.random().toString(36).substring(7),
                      name: defaults.name,
                      type,
                      baseUrl: defaults.baseUrl,
                      apiKey: '',
                      models: defaults.models,
                      isActive: providers.length === 0,
                    };
                    onUpdateProviders([...providers, newP]);
                  }}
                  className="text-[10px] font-bold text-left px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60 border border-zinc-300/40 dark:border-zinc-700/30 transition flex items-center justify-between"
                >
                  <span>{PROVIDER_DEFAULTS[type].name.split(' ')[0]}</span>
                  <Plus size={10} className="text-emerald-500" />
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
