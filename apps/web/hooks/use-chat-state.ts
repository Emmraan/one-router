'use client';

/* eslint-disable react-hooks/set-state-in-effect -- localStorage hydration runs once on mount; P4 replaces this hook with server data. */

import * as React from 'react';
import type { Chat, Provider } from '../lib/provider-types';

const PROVIDER_DEFAULTS: Provider[] = [
  {
    id: 'p-openai', name: 'OpenAI Direct', type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
    isActive: true,
  },
  {
    id: 'p-gemini', name: 'Gemini AI Studio', type: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
    isActive: false,
  },
  {
    id: 'p-ollama', name: 'Ollama local', type: 'ollama',
    baseUrl: 'http://localhost:11434',
    models: ['llama3', 'mistral', 'gemma'],
    isActive: false,
  },
];

export function useChatState() {
  const [sidebarOpen, setSidebarOpen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('onerouter_sidebar_open') !== 'false';
  });
  React.useEffect(() => {
    localStorage.setItem('onerouter_sidebar_open', String(sidebarOpen));
  }, [sidebarOpen]);

  const [dashboardOpen, setDashboardOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<{ providerId: string; model: string } | null>(null);
  const [isTempMode, setIsTempMode] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    const savedTheme = localStorage.getItem('onerouter_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('dark');
      localStorage.setItem('onerouter_theme', 'dark');
      document.documentElement.classList.add('dark');
    }

    const savedProviders = localStorage.getItem('onerouter_providers');
    let loadedProviders: Provider[] = [];
    if (savedProviders) {
      try {
        loadedProviders = JSON.parse(savedProviders);
      } catch (e) {
        console.error('Failed to parse providers, resetting default ones');
      }
    }

    if (loadedProviders.length === 0) {
      loadedProviders = PROVIDER_DEFAULTS;
      localStorage.setItem('onerouter_providers', JSON.stringify(loadedProviders));
    }
    setProviders(loadedProviders);

    const savedChats = localStorage.getItem('onerouter_chats');
    if (savedChats) {
      try {
        const loadedChats = JSON.parse(savedChats);
        const filtered = loadedChats
          .filter((c: Chat) => !c.isTemporary)
          .map((c: Chat) => ({ ...c, committed: true }));
        setChats(filtered);
        if (filtered.length > 0) {
          setActiveChatId(filtered[0].id);
        }
      } catch (e) {
        console.error('Failed parsing chats list');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('onerouter_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const handleUpdateProviders = (newProviders: Provider[]) => {
    setProviders(newProviders);
    localStorage.setItem('onerouter_providers', JSON.stringify(newProviders));
  };

  const createNewChat = (tempMode = false) => {
    const activeP = providers.find((p) => p.isActive) || providers[0];
    const defaultModel = activeP?.models?.[0] || 'default';

    const newChat: Chat = {
      id: Math.random().toString(36).substring(7),
      title: tempMode ? 'Ephemeral Private Chat' : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId: activeP?.id || '',
      model: defaultModel,
      messages: [],
      isTemporary: tempMode,
    };

    setIsTempMode(tempMode);

    if (tempMode) {
      setChats((prev) => [newChat, ...prev]);
    }

    setActiveChatId(newChat.id);
  };

  const deleteChat = (id: string) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      localStorage.setItem('onerouter_chats', JSON.stringify(filtered.filter(c => c.committed !== false)));
      return filtered;
    });
    setActiveChatId((prev) => {
      if (prev === id) {
        const remaining = chats.filter((c) => c.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  };

  const renameChat = (id: string, newTitle: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return { ...c, title: newTitle, updatedAt: Date.now() };
        }
        return c;
      });
      localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => c.committed !== false)));
      return updated;
    });
  };

  const togglePinChat = (id: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return { ...c, isPinned: !c.isPinned };
        }
        return c;
      });
      localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => c.committed !== false)));
      return updated;
    });
  };

  const selectModelAndProvider = (providerId: string, model: string) => {
    setSelectedModel({ providerId, model });

    setProviders((prev) => {
      const updated = prev.map((p) => ({
        ...p,
        isActive: p.id === providerId,
      }));
      localStorage.setItem('onerouter_providers', JSON.stringify(updated));
      return updated;
    });

    if (activeChatId) {
      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeChatId) {
            return { ...c, providerId, model };
          }
          return c;
        });
        localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => c.committed !== false)));
        return updated;
      });
    }
  };

  return {
    sidebarOpen, setSidebarOpen,
    dashboardOpen, setDashboardOpen,
    theme, setTheme,
    providers, setProviders,
    chats, setChats,
    activeChatId, setActiveChatId,
    selectedModel, setSelectedModel,
    isTempMode, setIsTempMode,
    mounted,
    toggleTheme,
    handleUpdateProviders,
    createNewChat,
    deleteChat,
    renameChat,
    togglePinChat,
    selectModelAndProvider,
  };
}
