'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiUrl,
  createChat,
  createMessage,
  deleteMessage,
  updateChat,
} from '../lib/api';
import { SseDecoder } from '../lib/sse';
import { queryKeys } from '../lib/query';
import type { ChatDto, MessageDto } from '../lib/api-types';
import type { Attachment, Provider } from '../lib/provider-types';

interface UseStreamingDeps {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  providers: Provider[];
  activeModel: string;
  providerId: string;
}

export function useStreaming({
  activeChatId,
  setActiveChatId,
  providers,
  activeModel,
  providerId,
}: UseStreamingDeps) {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const readMessages = React.useCallback(
    (chatId: string): MessageDto[] => queryClient.getQueryData<MessageDto[]>(queryKeys.messages(chatId)) ?? [],
    [queryClient],
  );

  const writeMessages = React.useCallback(
    (chatId: string, updater: (current: MessageDto[]) => MessageDto[]) => {
      queryClient.setQueryData<MessageDto[]>(queryKeys.messages(chatId), (old) => updater(old ?? []));
    },
    [queryClient],
  );

  const handleStopStreaming = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleSendMessage = React.useCallback(
    async (
      inputText: string,
      _attachmentsBuffer: Attachment[],
      setInputText: (value: string) => void,
      clearAttachments: () => void,
      customPrompt?: string,
      forceRegenerationIndex?: number,
      isUserEditIndex?: number,
    ) => {
      const promptToSend = (customPrompt ?? inputText).trim();
      if (
        !promptToSend &&
        forceRegenerationIndex === undefined &&
        isUserEditIndex === undefined
      ) {
        return;
      }
      if (isStreaming) return;

      const provider = providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive) ?? providers[0];
      if (!provider) {
        alert('Configure and select an active provider first inside Providers Central.');
        return;
      }
      if (!activeModel) {
        alert('No models found for this provider config.');
        return;
      }

      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setInputText('');
      clearAttachments();

      let chatId = activeChatId;
      let assistantTempId: string | null = null;

      try {
        const chatList = queryClient.getQueryData<ChatDto[]>(queryKeys.chats) ?? [];
        const existingChat = chatId ? chatList.find((c) => c.id === chatId) : undefined;

        if (!chatId) {
          const title = promptToSend.split(/\s+/).slice(0, 10).join(' ') || 'New Chat';
          const created = await createChat({ model: activeModel, providerId: provider.id, title });
          chatId = created.chat.id;
          setActiveChatId(chatId);
          writeMessages(chatId, () => []);
        } else if (existingChat && (existingChat.model !== activeModel || existingChat.providerId !== provider.id)) {
          await updateChat(chatId, { model: activeModel, providerId: provider.id });
        }

        const currentChatId = chatId;
        let local = readMessages(currentChatId);

        // Editing or regenerating truncates the tail on the server first so the
        // transcript and the model context stay in sync.
        if (isUserEditIndex !== undefined || forceRegenerationIndex !== undefined) {
          const cut = isUserEditIndex ?? forceRegenerationIndex ?? 0;
          const trailing = local.slice(cut);
          for (const message of trailing) {
            try {
              await deleteMessage(message.id);
            } catch {
              // Already gone; keep going.
            }
          }
          local = local.slice(0, cut);
        }

        if (forceRegenerationIndex === undefined) {
          const created = await createMessage(currentChatId, { role: 'user', content: promptToSend });
          local = [...local, created.message];
        }

        writeMessages(currentChatId, () => local);

        const outgoing = local.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          model: m.model ?? undefined,
        }));

        assistantTempId = `temp-${Math.random().toString(36).slice(2)}`;
        const tempId = assistantTempId;
        const tempMessage: MessageDto = {
          id: tempId,
          chatId: currentChatId,
          role: 'assistant',
          content: '',
          model: activeModel,
          position: local.length,
          isRegenerated: forceRegenerationIndex !== undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // The messages query can finish its first server fetch while the stream is
        // open; upserting keeps the optimistic bubble even if the cache is replaced.
        const upsertAssistant = (content: string) => {
          writeMessages(currentChatId, (current) => {
            const next = { ...tempMessage, content, updatedAt: Date.now() };
            return current.some((m) => m.id === tempId)
              ? current.map((m) => (m.id === tempId ? next : m))
              : [...current, next];
          });
        };

        const replaceTemp = (saved: MessageDto) => {
          writeMessages(currentChatId, (current) =>
            current.some((m) => m.id === tempId)
              ? current.map((m) => (m.id === tempId ? saved : m))
              : [...current, saved],
          );
        };

        upsertAssistant('');

        let buffer = '';

        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ providerId: provider.id, model: activeModel, messages: outgoing }),
        });

        if (!response.ok) {
          let detail = `Connect issue (${response.status})`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body?.error) detail = body.error;
          } catch {
            // Keep the status-based message.
          }
          throw new Error(detail);
        }

        const stream = response.body;
        if (!stream) throw new Error('Readable stream not ready');

        const reader = stream.getReader();
        const textDecoder = new TextDecoder('utf-8');
        const sse = new SseDecoder();

        const applyEvents = (events: ReturnType<SseDecoder['push']>) => {
          for (const event of events) {
            if (event.error) buffer += `\n\n*(Error while streaming: ${event.error})*`;
            if (event.text) buffer += event.text;
          }
          upsertAssistant(buffer);
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          applyEvents(sse.push(textDecoder.decode(value, { stream: true })));
        }
        applyEvents(sse.flush());

        const saved = await createMessage(currentChatId, {
          role: 'assistant',
          content: buffer,
          model: activeModel,
          isRegenerated: forceRegenerationIndex !== undefined,
        });
        replaceTemp(saved.message);
      } catch (error) {
        const err = error as { name?: string; message?: string };
        const failedChatId = chatId;
        const tempId = assistantTempId;
        if (!failedChatId || !tempId) {
          if (err.name !== 'AbortError') console.error('Core chat thread crashed:', error);
          return;
        }
        if (err.name === 'AbortError') {
          const partial = readMessages(failedChatId).find((m) => m.id === tempId)?.content ?? '';
          if (partial) {
            try {
              const saved = await createMessage(failedChatId, { role: 'assistant', content: partial, model: activeModel });
              writeMessages(failedChatId, (current) => current.map((m) => (m.id === tempId ? saved.message : m)));
            } catch {
              writeMessages(failedChatId, (current) => current.filter((m) => m.id !== tempId));
            }
          } else {
            writeMessages(failedChatId, (current) => current.filter((m) => m.id !== tempId));
          }
          return;
        }
        console.error('Core chat thread crashed:', error);
        const errorContent = `⚠️ **Routing Error:** ${err.message || 'The endpoint was unable to complete the instruction pack.'}`;
        writeMessages(failedChatId, (current) => {
          if (current.some((m) => m.id === tempId)) {
            return current.map((m) => (m.id === tempId ? { ...m, content: errorContent, updatedAt: Date.now() } : m));
          }
          return [
            ...current,
            {
              id: tempId,
              chatId: failedChatId,
              role: 'assistant',
              content: errorContent,
              model: activeModel,
              position: current.length,
              isRegenerated: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];
        });
        try {
          const saved = await createMessage(failedChatId, { role: 'assistant', content: errorContent, model: activeModel });
          writeMessages(failedChatId, (current) =>
            current.some((m) => m.id === tempId)
              ? current.map((m) => (m.id === tempId ? saved.message : m))
              : [...current, saved.message],
          );
        } catch {
          // Leave the local error bubble in place.
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      }
    },
    [
      activeChatId,
      activeModel,
      isStreaming,
      providerId,
      providers,
      queryClient,
      readMessages,
      setActiveChatId,
      writeMessages,
    ],
  );

  return { isStreaming, handleSendMessage, handleStopStreaming };
}
