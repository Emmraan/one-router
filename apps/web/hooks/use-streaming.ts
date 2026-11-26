'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiUrl,
  createChat,
  createMessage,
  deleteFile,
  deleteMessage,
  generateTitle,
  updateChat,
  updateMessage,
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
  onTemporaryTitle?: (chatId: string, title: string) => void;
}

const TEMPORARY_PREFIX = 'temporary-';
const isTemporaryId = (id: string) => id.startsWith(TEMPORARY_PREFIX);

function attachmentMeta(attachments: Attachment[]): Attachment[] {
  return attachments.map(({ id, name, type, size, url }) => ({ id, name, type, size, url }));
}

export function useStreaming({
  activeChatId,
  setActiveChatId,
  providers,
  activeModel,
  providerId,
  onTemporaryTitle,
}: UseStreamingDeps) {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [sendError, setSendError] = React.useState('');
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const streamingRef = React.useRef(false);

  React.useEffect(() => () => abortControllerRef.current?.abort(), []);

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
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const handleSendMessage = React.useCallback(
    async (
      inputText: string,
      attachmentsBuffer: Attachment[],
      setInputText: (value: string) => void,
      clearAttachments: () => void,
      customPrompt?: string,
      forceRegenerationIndex?: number,
      isUserEditIndex?: number,
    ) => {
      if (streamingRef.current) return;
      setSendError('');
      const promptToSend = (customPrompt ?? inputText).trim();
      const ready = attachmentsBuffer.filter((item) => item.status === 'ready');
      const hasPending = attachmentsBuffer.some((item) => item.status === 'uploading');
      const hasFailed = attachmentsBuffer.some((item) => item.status === 'error');
      if (hasPending || hasFailed) {
        setSendError('Wait for uploads to finish or remove failed files before sending.');
        return;
      }
      if (!promptToSend && ready.length === 0 && forceRegenerationIndex === undefined && isUserEditIndex === undefined) {
        return;
      }

      const provider = providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive) ?? providers[0];
      if (!provider) {
        setSendError('Configure and select an active provider in Providers Central.');
        return;
      }
      if (!activeModel) {
        setSendError('No model is selected for this provider.');
        return;
      }

      streamingRef.current = true;
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      let chatId = activeChatId;
      let temporary = Boolean(chatId && isTemporaryId(chatId));
      let assistantTempId: string | null = null;
      let userSaved = false;

      try {
        if (!chatId) {
          const title = promptToSend.split(/\s+/).slice(0, 10).join(' ').slice(0, 80) || 'New Chat';
          const created = await createChat({ model: activeModel, providerId: provider.id, title });
          chatId = created.chat.id;
          temporary = false;
          setActiveChatId(chatId);
          writeMessages(chatId, () => []);
        } else if (!temporary) {
          const chatList = queryClient.getQueryData<ChatDto[]>(queryKeys.chats) ?? [];
          const existing = chatList.find((chat) => chat.id === chatId);
          if (existing && (existing.model !== activeModel || existing.providerId !== provider.id)) {
            await updateChat(chatId, { model: activeModel, providerId: provider.id });
          }
        }

        const currentChatId = chatId;
        let local = readMessages(currentChatId);
        let firstExchange = false;

        if (isUserEditIndex !== undefined) {
          const target = local[isUserEditIndex];
          if (!target) throw new Error('The message being edited is no longer available.');
          const updated = { ...target, content: promptToSend, updatedAt: Date.now() };
          if (!temporary) {
            await updateMessage(target.id, promptToSend);
            for (const message of local.slice(isUserEditIndex + 1)) {
              await deleteMessage(message.id);
            }
          } else {
            await Promise.all(local.slice(isUserEditIndex + 1)
              .flatMap((message) => message.attachments ?? [])
              .map((attachment) => deleteFile(attachment.id, true).catch(() => undefined)));
          }
          local = [...local.slice(0, isUserEditIndex), updated];
          writeMessages(currentChatId, () => local);
          userSaved = true;
        } else if (forceRegenerationIndex !== undefined) {
          if (!temporary) {
            for (const message of local.slice(forceRegenerationIndex)) {
              await deleteMessage(message.id);
            }
          } else {
            await Promise.all(local.slice(forceRegenerationIndex)
              .flatMap((message) => message.attachments ?? [])
              .map((attachment) => deleteFile(attachment.id, true).catch(() => undefined)));
          }
          local = local.slice(0, forceRegenerationIndex);
          writeMessages(currentChatId, () => local);
          firstExchange = false;
        } else {
          const attachments = attachmentMeta(ready);
          const userMessage: MessageDto = {
            id: temporary ? `temporary-message-${crypto.randomUUID()}` : '',
            chatId: currentChatId,
            role: 'user',
            content: promptToSend,
            model: null,
            position: local.length,
            isRegenerated: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            attachments: attachments.length ? attachments : undefined,
          };
          if (!temporary) {
            const created = await createMessage(currentChatId, {
              role: 'user',
              content: promptToSend,
              attachmentIds: attachments.map((item) => item.id),
            });
            Object.assign(userMessage, created.message);
          }
          local = [...local, userMessage];
          writeMessages(currentChatId, () => local);
          firstExchange = local.length === 1;
          userSaved = true;
        }

        if (userSaved) {
          setInputText('');
          clearAttachments();
        }

        const outgoing = local.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.createdAt,
          model: message.model ?? undefined,
          attachments: message.attachments?.map(({ id, name, type, size, url }) => ({ id, name, type, size, url })),
        }));

        assistantTempId = `temp-${crypto.randomUUID()}`;
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

        const upsertAssistant = (content: string) => {
          writeMessages(currentChatId, (current) => {
            const next = { ...tempMessage, content, updatedAt: Date.now() };
            return current.some((message) => message.id === tempId)
              ? current.map((message) => (message.id === tempId ? next : message))
              : [...current, next];
          });
        };
        upsertAssistant('');

        let buffer = '';
        let streamError = '';
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]),
          body: JSON.stringify({ providerId: provider.id, model: activeModel, messages: outgoing }),
        });

        if (!response.ok) {
          let detail = response.status === 401
            ? 'Your session expired. Sign in again.'
            : `The provider request failed (${response.status}).`;
          try {
            const errorBody = (await response.json()) as { error?: string };
            if (errorBody?.error) detail = errorBody.error;
          } catch {
            // Keep the status-based message.
          }
          throw new Error(detail);
        }
        if (!response.body) throw new Error('The provider returned no stream.');

        const reader = response.body.getReader();
        const textDecoder = new TextDecoder('utf-8');
        const sse = new SseDecoder();
        const applyEvents = (events: ReturnType<SseDecoder['push']>) => {
          for (const event of events) {
            if (event.error) streamError = event.error;
            if (event.text) buffer += event.text;
          }
          upsertAssistant(buffer);
        };

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            applyEvents(sse.push(textDecoder.decode(value, { stream: true })));
          }
          applyEvents(sse.flush());
        } finally {
          reader.releaseLock();
        }

        let saved: MessageDto;
        if (temporary) {
          saved = {
            ...tempMessage,
            id: `temporary-message-${crypto.randomUUID()}`,
            content: buffer,
            position: local.length,
            isRegenerated: forceRegenerationIndex !== undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        } else {
          const created = await createMessage(currentChatId, {
            role: 'assistant',
            content: buffer,
            model: activeModel,
            isRegenerated: forceRegenerationIndex !== undefined,
          });
          saved = created.message;
        }
        writeMessages(currentChatId, (current) =>
          current.some((message) => message.id === tempId)
            ? current.map((message) => (message.id === tempId ? saved : message))
            : [...current, saved],
        );
        assistantTempId = null;

        if (streamError) {
          setSendError(streamError);
        } else if (firstExchange && promptToSend) {
          void generateTitle(promptToSend, provider.id, activeModel)
            .then(({ title }) => {
              if (temporary) onTemporaryTitle?.(currentChatId, title);
              else void updateChat(currentChatId, { title, source: 'automatic' });
            })
            .catch(() => undefined);
        }
      } catch (error) {
        const err = error as { name?: string; message?: string };
        const failedChatId = chatId;
        const tempId = assistantTempId;
        if (err.name === 'AbortError') {
          if (failedChatId && tempId) {
            const partial = readMessages(failedChatId).find((message) => message.id === tempId)?.content ?? '';
            if (partial && !temporary) {
              try {
                const saved = await createMessage(failedChatId, { role: 'assistant', content: partial, model: activeModel });
                writeMessages(failedChatId, (current) => current.map((message) => (message.id === tempId ? saved.message : message)));
              } catch {
                writeMessages(failedChatId, (current) => current.filter((message) => message.id !== tempId));
              }
            } else if (partial && temporary) {
              writeMessages(failedChatId, (current) => current.map((message) => (
                message.id === tempId
                  ? { ...message, id: `temporary-message-${crypto.randomUUID()}`, content: partial, createdAt: Date.now(), updatedAt: Date.now() }
                  : message
              )));
            } else {
              writeMessages(failedChatId, (current) => current.filter((message) => message.id !== tempId));
            }
          }
        } else {
          if (failedChatId && tempId) {
            writeMessages(failedChatId, (current) => current.filter((message) => message.id !== tempId));
          }
          setSendError(err.message || 'The provider request failed.');
        }
      } finally {
        abortControllerRef.current = null;
        streamingRef.current = false;
        setIsStreaming(false);
        if (chatId && !temporary) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
          void queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
        }
      }
    },
    [
      activeChatId,
      activeModel,
      onTemporaryTitle,
      providerId,
      providers,
      queryClient,
      readMessages,
      setActiveChatId,
      writeMessages,
    ],
  );

  return { isStreaming, sendError, setSendError, handleSendMessage, handleStopStreaming };
}
