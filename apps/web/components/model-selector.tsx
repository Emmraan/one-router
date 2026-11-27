'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Search, Star } from 'lucide-react';
import { Dialog } from '@one-router/ui/dialog';
import { useSettings } from '../hooks/use-settings';
import { putSetting } from '../lib/api';
import { queryKeys } from '../lib/query';
import type { Provider } from '../lib/provider-types';

interface Props {
  providers: Provider[]; activeModel: string; activeProviderId: string;
  onSelectModelAndProvider: (providerId: string, model: string) => void;
}
type ModelRef = { providerId: string; model: string };

export function ModelSelector({ providers, activeModel, activeProviderId, onSelectModelAndProvider }: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [cursor, setCursor] = React.useState(-1);
  const settings = useSettings();
  const client = useQueryClient();
  const favourites = (Array.isArray(settings.data?.favouriteModels) ? settings.data.favouriteModels : []) as ModelRef[];
  const recents = (Array.isArray(settings.data?.recentModels) ? settings.data.recentModels : []) as ModelRef[];
  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: ModelRef[] }) => putSetting(key, value),
    onSuccess: (_data, { key, value }) => client.setQueryData(queryKeys.settings, (old: Record<string, unknown> | undefined) => ({ ...old, [key]: value })),
  });
  const matches = providers.flatMap((provider) => provider.models.map((model) => ({ providerId: provider.id, providerName: provider.name, model })))
    .filter((item) => `${item.model} ${item.providerName}`.toLowerCase().includes(search.toLowerCase()));
  const isFavourite = (item: ModelRef) => favourites.some((ref) => ref?.providerId === item.providerId && ref.model === item.model);
  const ordered = [...matches].sort((a, b) => Number(isFavourite(b)) - Number(isFavourite(a)) ||
    Number(recents.some((r) => r?.model === b.model && r.providerId === b.providerId)) - Number(recents.some((r) => r?.model === a.model && r.providerId === a.providerId)));
  const shown = ordered.slice(0, 100);
  const select = (item: ModelRef) => {
    onSelectModelAndProvider(item.providerId, item.model);
    setOpen(false);
    save.mutate({ key: 'recentModels', value: [item, ...recents.filter((ref) => ref?.model !== item.model || ref.providerId !== item.providerId)].slice(0, 5) });
  };
  return <>
    <button type="button" className="model-trigger" aria-label={`Choose model, ${activeModel || 'none selected'}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setOpen(true); setSearch(''); setCursor(-1); }}>
      <span className="min-w-0"><span className="block truncate font-semibold">{activeModel || 'Choose a model'}</span><span className="block truncate text-[11px] muted">{providers.find((p) => p.id === activeProviderId)?.name || 'Add a provider to get started'}</span></span><ChevronDown size={14} />
    </button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Choose model" description="Search your providers. Favourites appear first." className="model-dialog">
      <div className="model-search"><Search size={16} /><input data-autofocus aria-label="Search models" placeholder="Search models or providers" value={search} maxLength={200}
        onChange={(event) => { setSearch(event.target.value); setCursor(-1); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = event.key === 'ArrowDown' ? Math.min(cursor + 1, shown.length - 1) : Math.max(cursor - 1, 0);
            setCursor(next);
            document.getElementById(`model-option-${next}`)?.scrollIntoView({ block: 'nearest' });
          }
          if (event.key === 'Enter' && shown[cursor < 0 ? 0 : cursor]) { event.preventDefault(); select(shown[cursor < 0 ? 0 : cursor]); }
        }} role="combobox" aria-haspopup="grid" aria-expanded="true" aria-autocomplete="list" aria-controls="model-options" aria-activedescendant={cursor >= 0 && shown[cursor] ? `model-option-${cursor}` : undefined} />
      </div>
      <div className="model-options" id="model-options" role="grid" aria-label="Models" aria-colcount={2}>
        {shown.map((item, index) => <div role="row" className={`model-row ${cursor === index ? 'model-highlight' : ''}`} key={`${item.providerId}/${item.model}`}>
          <div role="gridcell" id={`model-option-${index}`} aria-selected={item.model === activeModel && item.providerId === activeProviderId} className="min-w-0 flex-1">
          <button type="button" onClick={() => select(item)} className="model-option w-full"><span className="min-w-0"><span className="block truncate">{item.model}</span><span className="block muted text-[11px]">{item.providerName}</span></span>{item.model === activeModel && item.providerId === activeProviderId && <Check size={15} />}</button></div>
          <div role="gridcell"><button type="button" className="icon-button" disabled={save.isPending} aria-label={`${isFavourite(item) ? 'Unfavourite' : 'Favourite'} ${item.model}`}
            onClick={() => save.mutate({ key: 'favouriteModels', value: isFavourite(item) ? favourites.filter((ref) => !(ref?.providerId === item.providerId && ref.model === item.model)) : [...favourites, { providerId: item.providerId, model: item.model }].slice(-100) })}>
            <Star size={15} fill={isFavourite(item) ? 'currentColor' : 'none'} />
          </button></div>
        </div>)}
        {shown.length === 0 && <p className="muted p-6">{providers.length ? 'No matching models.' : 'Add a provider in Providers to choose a model.'}</p>}
      </div>
      {ordered.length > 100 && <p className="muted px-6 py-3">Showing 100 of {ordered.length}. Refine your search to see more.</p>}
      {save.error && <p role="alert" className="error-notice px-6 py-3">Could not save model preferences. Try again.</p>}
    </Dialog>
  </>;
}
