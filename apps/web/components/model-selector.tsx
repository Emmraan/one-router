'use client';

import * as React from 'react';
import { 
  ChevronDown, Search, Star, History, Check, Cpu, Sparkles 
} from 'lucide-react';
import { Provider } from '../lib/provider-types';

interface ModelSelectorProps {
  providers: Provider[];
  activeModel: string;
  activeProviderId: string;
  onSelectModelAndProvider: (providerId: string, model: string) => void;
}

interface ModelItem {
  providerId: string;
  providerName: string;
  model: string;
}

export function ModelSelector({
  providers,
  activeModel,
  activeProviderId,
  onSelectModelAndProvider,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [favourites, setFavourites] = React.useState<{ providerId: string; model: string }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedFavs = localStorage.getItem('onerouter_favourite_models');
        return storedFavs ? JSON.parse(storedFavs) : [];
      } catch (e) {
        console.error('Failed to parse favourites:', e);
      }
    }
    return [];
  });
  
  const [recents, setRecents] = React.useState<{ providerId: string; model: string }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedRecents = localStorage.getItem('onerouter_recent_models');
        return storedRecents ? JSON.parse(storedRecents) : [];
      } catch (e) {
        console.error('Failed to parse recents:', e);
      }
    }
    return [];
  });
  
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Handle outside clicks to close the dropdown
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Toggle favourite status
  const toggleFavourite = (providerId: string, model: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = favourites.some((f) => f.providerId === providerId && f.model === model);
    let updated;
    if (isFav) {
      updated = favourites.filter((f) => !(f.providerId === providerId && f.model === model));
    } else {
      updated = [...favourites, { providerId, model }];
    }
    setFavourites(updated);
    localStorage.setItem('onerouter_favourite_models', JSON.stringify(updated));
  };

  // Add selected item to recents and select it
  const handleSelectModel = (providerId: string, model: string) => {
    // Call the parent state updater
    onSelectModelAndProvider(providerId, model);
    setIsOpen(false);

    // Update recents
    const filtered = recents.filter((r) => !(r.providerId === providerId && r.model === model));
    const updated = [{ providerId, model }, ...filtered].slice(0, 5); // Max 5 recents
    setRecents(updated);
    localStorage.setItem('onerouter_recent_models', JSON.stringify(updated));
  };

  // Build full flat models dataset for easier querying
  const allModels: ModelItem[] = React.useMemo(() => {
    const list: ModelItem[] = [];
    providers.forEach((p) => {
      if (p.models && Array.isArray(p.models)) {
        p.models.forEach((m) => {
          list.push({
            providerId: p.id,
            providerName: p.name,
            model: m,
          });
        });
      }
    });
    return list;
  }, [providers]);

  // Get active provider & display metadata
  const currentActiveProvider = providers.find((p) => p.id === activeProviderId) || providers[0];

  // Filters candidates based on query
  const queryLower = searchQuery.toLowerCase();
  
  const filteredModels = allModels.filter((item) =>
    item.model.toLowerCase().includes(queryLower) ||
    item.providerName.toLowerCase().includes(queryLower)
  );

  const filteredFavourites = favourites
    .map((fav) => {
      const match = allModels.find((m) => m.providerId === fav.providerId && m.model === fav.model);
      return match || { providerId: fav.providerId, providerName: 'Unknown', model: fav.model };
    })
    .filter((item) =>
      item.model.toLowerCase().includes(queryLower) ||
      item.providerName.toLowerCase().includes(queryLower)
    );

  const filteredRecents = recents
    .map((rec) => {
      const match = allModels.find((m) => m.providerId === rec.providerId && m.model === rec.model);
      return match || { providerId: rec.providerId, providerName: 'Unknown', model: rec.model };
    })
    .filter((item) =>
      item.model.toLowerCase().includes(queryLower) ||
      item.providerName.toLowerCase().includes(queryLower)
    );

  // Grouping remaining models after search by provider
  const groupedByProvider = filteredModels.reduce<Record<string, { name: string; items: ModelItem[] }>>(
    (acc, item) => {
      if (!acc[item.providerId]) {
        acc[item.providerId] = { name: item.providerName, items: [] };
      }
      acc[item.providerId].items.push(item);
      return acc;
    },
    {}
  );

  return (
    <div className="relative" ref={containerRef} id="model-router-wrapper">
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0f0f0f] hover:bg-zinc-50 dark:hover:bg-zinc-900 text-gray-900 dark:text-zinc-100 rounded-xl text-xs font-semibold shadow-xs transition duration-200 cursor-pointer"
        id="btn-model-router-trigger"
      >
        <div className="flex flex-col items-start">
          <span className="font-extrabold text-sm tracking-tight leading-none">ONE ROUTER</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate max-w-[140px] md:max-w-[200px]">
            {activeModel || 'Select model'}
          </span>
        </div>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-72 md:w-80 bg-white dark:bg-[#0d0d0d] rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden max-h-[480px] border border-zinc-200 dark:border-zinc-800 animate-fade-in"
          id="model-router-dropdown"
        >
            {/* Realtime Search Input */}
            <div className="p-3 border-b border-zinc-100/50 dark:border-zinc-800/30 bg-zinc-50/30 dark:bg-zinc-950/10 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search target engines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/40 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-805 dark:text-zinc-200 placeholder-zinc-450 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all font-medium"
                  id="search-models-input"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-500 rounded cursor-pointer transition"
                  >
                    <span className="text-[10px] font-bold">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Models Stream Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3.5 scrollbar-thin">
              {/* No items matching query */}
              {filteredModels.length === 0 && (
                <div className="p-8 text-center text-zinc-400 dark:text-zinc-650">
                  <Sparkles size={16} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                  <p className="text-[11px] font-semibold">No node engines found</p>
                </div>
              )}

              {/* Favourites Section */}
              {filteredFavourites.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-widest">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    <span>Favourites</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {filteredFavourites.map((item) => {
                      const isActive = item.model === activeModel && item.providerId === activeProviderId;
                      return (
                        <div
                          key={`fav-${item.providerId}-${item.model}`}
                          onClick={() => handleSelectModel(item.providerId, item.model)}
                          className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Cpu size={12} className={isActive ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-600'} />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-semibold">{item.model}</span>
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{item.providerName}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {isActive && <Check size={12} className="text-emerald-500 shrink-0" />}
                            <button
                              type="button"
                              onClick={(e) => toggleFavourite(item.providerId, item.model, e)}
                              className="p-1.5 rounded-lg text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                              title="Remove from Favourites"
                            >
                              <Star size={11} className="fill-current" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recents Section */}
              {filteredRecents.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-widest">
                    <History size={10} className="text-emerald-500" />
                    <span>Recently Used</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {filteredRecents.map((item) => {
                      const isActive = item.model === activeModel && item.providerId === activeProviderId;
                      const isFav = favourites.some((f) => f.providerId === item.providerId && f.model === item.model);
                      return (
                        <div
                          key={`rec-${item.providerId}-${item.model}`}
                          onClick={() => handleSelectModel(item.providerId, item.model)}
                          className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Cpu size={12} className={isActive ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-650'} />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-semibold">{item.model}</span>
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{item.providerName}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {isActive && <Check size={12} className="text-emerald-500 shrink-0" />}
                            <button
                              type="button"
                              onClick={(e) => toggleFavourite(item.providerId, item.model, e)}
                              className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer ${
                                isFav ? 'text-amber-400' : 'text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400'
                              }`}
                              title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                            >
                              <Star size={11} className={isFav ? 'fill-current' : ''} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Providers & their models */}
              {Object.entries(groupedByProvider).map(([providerId, group]) => (
                <div key={providerId} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800/40 pb-0.5">
                    {group.name}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = item.model === activeModel && item.providerId === activeProviderId;
                      const isFav = favourites.some((f) => f.providerId === item.providerId && f.model === item.model);
                      return (
                        <div
                          key={`all-${item.providerId}-${item.model}`}
                          onClick={() => handleSelectModel(item.providerId, item.model)}
                          className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-zinc-750 dark:text-zinc-350 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Cpu size={12} className={isActive ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-750'} />
                            <span className="truncate font-semibold">{item.model}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {isActive && <Check size={12} className="text-emerald-500 shrink-0" />}
                            <button
                              type="button"
                              onClick={(e) => toggleFavourite(item.providerId, item.model, e)}
                              className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer ${
                                isFav ? 'text-amber-400' : 'opacity-0 group-hover:opacity-100 text-zinc-300 dark:text-zinc-700 hover:text-zinc-450'
                              }`}
                              title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                            >
                              <Star size={11} className={isFav ? 'fill-current' : ''} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Status Bar */}
            <div className="px-3.5 py-2.5 bg-zinc-50/50 dark:bg-zinc-950/20 border-t border-zinc-100/50 dark:border-zinc-800/30 text-[10px] text-zinc-450 dark:text-zinc-550 flex justify-between items-center shrink-0 font-mono">
              <span>Total Engine Nodes:</span>
              <span className="font-bold text-emerald-500">{allModels.length}</span>
            </div>
        </div>
      )}
    </div>
  );
}
