'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChats, useDeleteChat, useUpdateChat } from './use-chats';
import { useMessages } from './use-messages';
import { useProviders } from './use-providers';
import { useTheme } from './use-settings';
import { deleteFile, saveConversation } from '../lib/api';
import { queryKeys } from '../lib/query';
import type { MessageDto } from '../lib/api-types';
import type { Chat, Message, Provider } from '../lib/provider-types';

const SIDEBAR_KEY = 'onerouter_sidebar_open';
const TEMPORARY_PREFIX = 'temporary-';
export const isTemporaryChatId = (id: string | null): boolean => Boolean(id?.startsWith(TEMPORARY_PREFIX));

function toMessage(dto: MessageDto): Message {
  return {
    id: dto.id,
    role: dto.role,
    content: dto.content,
    timestamp: dto.createdAt,
    model: dto.model ?? undefined,
    isRegenerated: dto.isRegenerated,
    attachments: dto.attachments,
  };
}

type PendingNavigation = { type: 'chat'; id: string } | { type: 'new' } | null;

export function useChatState() {
  const queryClient = useQueryClient();
  const { data: providerDtos = [] } = useProviders();
  const { data: chatDtos = [] } = useChats();
  const { theme, toggleTheme } = useTheme();
  const updateChatMutation = useUpdateChat();
  const deleteChatMutation = useDeleteChat();

  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [dashboardOpen, setDashboardOpen] = React.useState(false);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<{ providerId: string; model: string } | null>(null);
  const [temporaryChat, setTemporaryChat] = React.useState<Chat | null>(null);
  const [savingTemporary, setSavingTemporary] = React.useState(false);
  const [temporaryError, setTemporaryError] = React.useState('');
  const [pendingNavigation, setPendingNavigation] = React.useState<PendingNavigation>(null);
  const [mounted, setMounted] = React.useState(false);

  const temporary = isTemporaryChatId(activeChatId);
  const { data: messageDtos = [] } = useMessages(activeChatId, !temporary);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) setSidebarOpen(stored === 'true');
  }, []);

  React.useEffect(() => {
    if (mounted) localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
  }, [sidebarOpen, mounted]);

  const providers: Provider[] = React.useMemo(
    () => providerDtos.map((provider) => ({
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

  const chats: Chat[] = React.useMemo(() => {
    const saved = chatDtos.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      providerId: chat.providerId,
      model: chat.model,
      isPinned: chat.isPinned,
      manualTitle: chat.manualTitle,
      messages: chat.id === activeChatId ? messages : [],
    })).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!temporaryChat) return saved;
    return [{ ...temporaryChat, messages: temporaryChat.id === activeChatId ? messages : [] }, ...saved];
  }, [chatDtos, activeChatId, messages, temporaryChat]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const activeProvider = providers.find((provider) => provider.isActive) ?? providers[0];
  const activeProviderId = selectedModel?.providerId ?? activeChat?.providerId ?? activeProvider?.id ?? '';
  const activeModel = selectedModel?.model ?? activeChat?.model ?? activeProvider?.models[0] ?? '';

  React.useEffect(() => {
    if (!activeChat) return;
    setSelectedModel({
      providerId: activeChat.providerId ?? activeProvider?.id ?? '',
      model: activeChat.model,
    });
  // The effect keys off primitive fields; the active chat object changes on every token.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, activeChat?.id, activeChat?.model, activeChat?.providerId, activeProvider?.id]);

  React.useEffect(() => {
    if (!temporary || messages.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [temporary, messages.length]);

  const readTemporaryMessages = React.useCallback(
    (id: string) => queryClient.getQueryData<MessageDto[]>(queryKeys.messages(id)) ?? [],
    [queryClient],
  );

  const updateTemporaryTitle = React.useCallback((id: string, title: string) => {
    setTemporaryChat((current) => current && current.id === id && !current.manualTitle
      ? { ...current, title, updatedAt: Date.now() }
      : current);
  }, []);

  const createTemporaryChat = React.useCallback(() => {
    if (temporaryChat) {
      setActiveChatId(temporaryChat.id);
      return temporaryChat.id;
    }
    const id = `${TEMPORARY_PREFIX}${crypto.randomUUID()}`;
    const now = Date.now();
    const provider = providers.find((item) => item.isActive) ?? providers[0];
    setTemporaryChat({
      id,
      title: 'Temporary chat',
      createdAt: now,
      updatedAt: now,
      providerId: provider?.id ?? null,
      model: selectedModel?.model ?? provider?.models[0] ?? '',
      messages: [],
      isPinned: false,
      manualTitle: false,
    });
    queryClient.setQueryData<MessageDto[]>(queryKeys.messages(id), []);
    setTemporaryError('');
    setActiveChatId(id);
    return id;
  }, [providers, queryClient, selectedModel?.model, temporaryChat]);

  const discardTemporaryChat = React.useCallback(async () => {
    if (!temporaryChat) return;
    const files = readTemporaryMessages(temporaryChat.id)
      .flatMap((message) => message.attachments ?? [])
      .map((attachment) => attachment.id);
    queryClient.removeQueries({ queryKey: queryKeys.messages(temporaryChat.id) });
    setTemporaryChat(null);
    setTemporaryError('');
    if (activeChatId === temporaryChat.id) setActiveChatId(null);
    await Promise.all([...new Set(files)].map((id) => deleteFile(id, true).catch(() => undefined)));
  }, [activeChatId, queryClient, readTemporaryMessages, temporaryChat]);

  const saveTemporaryChat = React.useCallback(async (overrides?: { providerId?: string; model?: string }) => {
    if (!temporaryChat || savingTemporary) return null;
    const records = readTemporaryMessages(temporaryChat.id);
    if (records.length === 0) return null;
    setSavingTemporary(true);
    setTemporaryError('');
    try {
      const firstUser = records.find((message) => message.role === 'user')?.content ?? '';
      const fallbackTitle = firstUser.split(/\s+/).slice(0, 10).join(' ').slice(0, 80) || 'New Chat';
      const result = await saveConversation({
        title: temporaryChat.manualTitle ? temporaryChat.title : fallbackTitle,
        model: overrides?.model ?? temporaryChat.model,
        providerId: overrides?.providerId ?? temporaryChat.providerId,
        messages: records.map((message) => ({
          role: message.role,
          content: message.content,
          model: message.model ?? undefined,
          createdAt: message.createdAt,
          isRegenerated: message.isRegenerated,
          attachmentIds: message.attachments?.map((attachment) => attachment.id),
        })),
      });
      queryClient.removeQueries({ queryKey: queryKeys.messages(temporaryChat.id) });
      setTemporaryChat(null);
      setActiveChatId(result.chat.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      return result.chat.id;
    } catch (error) {
      setTemporaryError(error instanceof Error ? error.message : 'The temporary chat could not be saved.');
      return null;
    } finally {
      setSavingTemporary(false);
    }
  }, [queryClient, readTemporaryMessages, savingTemporary, temporaryChat]);

  const applyNavigation = React.useCallback((target: Exclude<PendingNavigation, null>) => {
    setActiveChatId(target.type === 'chat' ? target.id : null);
  }, []);

  const requestNavigation = React.useCallback((target: Exclude<PendingNavigation, null>) => {
    if (!temporaryChat || activeChatId !== temporaryChat.id) {
      applyNavigation(target);
      return;
    }
    if (readTemporaryMessages(temporaryChat.id).length === 0) {
      void discardTemporaryChat().then(() => applyNavigation(target));
      return;
    }
    setPendingNavigation(target);
  }, [activeChatId, applyNavigation, discardTemporaryChat, readTemporaryMessages, temporaryChat]);

  const resolvePendingNavigation = React.useCallback(async (action: 'save' | 'discard' | 'cancel') => {
    if (action === 'cancel') {
      setPendingNavigation(null);
      return;
    }
    if (!pendingNavigation) return;
    if (action === 'save') {
      const saved = await saveTemporaryChat();
      if (!saved) return;
    } else {
      await discardTemporaryChat();
    }
    applyNavigation(pendingNavigation);
    setPendingNavigation(null);
  }, [applyNavigation, discardTemporaryChat, pendingNavigation, saveTemporaryChat]);

  const selectModelAndProvider = React.useCallback(
    (nextProviderId: string, model: string) => {
      setSelectedModel({ providerId: nextProviderId, model });
      if (activeChatId && isTemporaryChatId(activeChatId)) {
        setTemporaryChat((current) => current && current.id === activeChatId
          ? { ...current, providerId: nextProviderId, model, updatedAt: Date.now() }
          : current);
      } else if (activeChatId) {
        updateChatMutation.mutate({ id: activeChatId, patch: { providerId: nextProviderId, model } });
      }
    },
    [activeChatId, updateChatMutation],
  );

  const createNewChat = React.useCallback(() => {
    requestNavigation({ type: 'new' });
  }, [requestNavigation]);

  const selectChat = React.useCallback((id: string) => {
    if (id === activeChatId) return;
    requestNavigation({ type: 'chat', id });
  }, [activeChatId, requestNavigation]);

  const deleteChat = React.useCallback(
    (id: string) => {
      if (isTemporaryChatId(id)) {
        void discardTemporaryChat();
        return;
      }
      deleteChatMutation.mutate(id);
      if (activeChatId === id) setActiveChatId(null);
    },
    [activeChatId, deleteChatMutation, discardTemporaryChat],
  );

  const renameChat = React.useCallback(
    (id: string, newTitle: string) => {
      const title = newTitle.trim().slice(0, 80);
      if (!title) return;
      if (isTemporaryChatId(id)) {
        setTemporaryChat((current) => current && current.id === id
          ? { ...current, title, manualTitle: true, updatedAt: Date.now() }
          : current);
        return;
      }
      updateChatMutation.mutate({ id, patch: { title, source: 'manual' } });
    },
    [updateChatMutation],
  );

  const togglePinChat = React.useCallback(
    (id: string) => {
      if (isTemporaryChatId(id)) return;
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
    selectChat,
    deleteChat,
    renameChat,
    togglePinChat,
    selectModelAndProvider,
    temporaryChat,
    savingTemporary,
    temporaryError,
    setTemporaryError,
    createTemporaryChat,
    saveTemporaryChat,
    discardTemporaryChat,
    updateTemporaryTitle,
    pendingNavigation,
    resolvePendingNavigation,
  };
}
