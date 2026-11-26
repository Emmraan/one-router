'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from 'react';
import { useChats, useDeleteChat, useUpdateChat } from './use-chats';
import { useMessages } from './use-messages';
import { useProviders } from './use-providers';
import { useTheme } from './use-settings';
import type { MessageDto } from '../lib/api-types';
import type { Chat, Message, Provider } from '../lib/provider-types';

const SIDEBAR_KEY = 'onerouter_sidebar_open';

function toMessage(dto: MessageDto): Message {
  return {
    id: dto.id,
    role: dto.role,
    content: dto.content,
    timestamp: dto.createdAt,
    model: dto.model ?? undefined,
    isRegenerated: dto.isRegenerated,
  };
}

export function useChatState() {
  const { data: providerDtos = [] } = useProviders();
  const { data: chatDtos = [] } = useChats();
  const { theme, toggleTheme } = useTheme();
  const updateChatMutation = useUpdateChat();
  const deleteChatMutation = useDeleteChat();

  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [dashboardOpen, setDashboardOpen] = React.useState(false);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<{ providerId: string; model: string } | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const { data: messageDtos = [] } = useMessages(activeChatId);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) setSidebarOpen(stored === 'true');
  }, []);

  React.useEffect(() => {
    if (mounted) localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
  }, [sidebarOpen, mounted]);

  const providers: Provider[] = React.useMemo(
    () =>
      providerDtos.map((provider) => ({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl,
        models: provider.models,
        isActive: provider.isActive,
        hasApiKey: provider.hasApiKey,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      })),
    [providerDtos],
  );

  const messages: Message[] = React.useMemo(() => messageDtos.map(toMessage), [messageDtos]);

  const chats: Chat[] = React.useMemo(
    () =>
      chatDtos
        .map((chat) => ({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          providerId: chat.providerId,
          model: chat.model,
          isPinned: chat.isPinned,
          manualTitle: chat.manualTitle,
          messages: chat.id === activeChatId ? messages : [],
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [chatDtos, activeChatId, messages],
  );

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const activeProvider = providers.find((provider) => provider.isActive) ?? providers[0];
  const activeProviderId = selectedModel?.providerId ?? activeChat?.providerId ?? activeProvider?.id ?? '';
  const activeModel = selectedModel?.model ?? activeChat?.model ?? activeProvider?.models[0] ?? '';

  // Opening a chat adopts the model recorded on it so the header matches the
  // transcript the assistant actually used.
  React.useEffect(() => {
    if (!activeChat) return;
    setSelectedModel({
      providerId: activeChat.providerId ?? activeProvider?.id ?? '',
      model: activeChat.model,
    });
  // The effect intentionally keys off primitive fields; depending on the
  // `activeChat` object would re-run on every streamed message.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, activeChat?.id, activeChat?.model, activeChat?.providerId, activeProvider?.id]);

  const selectModelAndProvider = React.useCallback(
    (providerId: string, model: string) => {
      setSelectedModel({ providerId, model });
      if (activeChatId) {
        updateChatMutation.mutate({ id: activeChatId, patch: { providerId, model } });
      }
    },
    [activeChatId, updateChatMutation],
  );

  const createNewChat = React.useCallback(() => {
    setActiveChatId(null);
  }, []);

  const deleteChat = React.useCallback(
    (id: string) => {
      deleteChatMutation.mutate(id);
      if (activeChatId === id) setActiveChatId(null);
    },
    [activeChatId, deleteChatMutation],
  );

  const renameChat = React.useCallback(
    (id: string, newTitle: string) => {
      updateChatMutation.mutate({ id, patch: { title: newTitle, source: 'manual' } });
    },
    [updateChatMutation],
  );

  const togglePinChat = React.useCallback(
    (id: string) => {
      const chat = chats.find((item) => item.id === id);
      if (!chat) return;
      updateChatMutation.mutate({ id, patch: { isPinned: !chat.isPinned } });
    },
    [chats, updateChatMutation],
  );

  return {
    sidebarOpen,
    setSidebarOpen,
    dashboardOpen,
    setDashboardOpen,
    theme,
    providers,
    chats,
    messages,
    activeChatId,
    setActiveChatId,
    activeChat,
    activeModel,
    activeProviderId,
    mounted,
    toggleTheme,
    createNewChat,
    deleteChat,
    renameChat,
    togglePinChat,
    selectModelAndProvider,
  };
}