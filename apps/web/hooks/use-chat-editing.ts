'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteFile, deleteMessage as deleteMessageRequest, updateMessage as updateMessageRequest } from '../lib/api';
import { queryKeys } from '../lib/query';
import type { MessageDto } from '../lib/api-types';
import type { Message } from '../lib/provider-types';

export function exportMessageToMarkdown(content: string, id: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `assistant_message_${id}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface UseChatEditingDeps {
  activeChatId: string | null;
  messages: Message[];
  sendMessage: (customPrompt?: string, forceRegen?: number, editIndex?: number) => void;
}

export function useChatEditing({ activeChatId, messages, sendMessage }: UseChatEditingDeps) {
  const queryClient = useQueryClient();
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = React.useState('');
  const [editError, setEditError] = React.useState('');
  const temporary = Boolean(activeChatId?.startsWith('temporary-'));

  const handleEditMessage = (id: string, content: string) => {
    setEditingMessageId(id);
    setEditingMessageText(content);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const saveEditedMessage = async (index: number, isUserMsg: boolean) => {
    const message = messages[index];
    if (!message || !activeChatId) return;
    if (isUserMsg) {
      cancelEditMessage();
      sendMessage(editingMessageText, undefined, index);
      return;
    }
    const content = editingMessageText;
    const chatId = activeChatId;
    queryClient.setQueryData<MessageDto[]>(queryKeys.messages(chatId), (old) =>
      (old ?? []).map((m) => (m.id === message.id ? { ...m, content, updatedAt: Date.now() } : m)),
    );
    cancelEditMessage();
    try {
      if (!temporary) await updateMessageRequest(message.id, content);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'The message could not be edited.');
      if (!temporary) void queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    }
  };

  const deleteMessage = async (id: string) => {
    if (!activeChatId) return;
    const chatId = activeChatId;
    const message = messages.find((item) => item.id === id);
    queryClient.setQueryData<MessageDto[]>(queryKeys.messages(chatId), (old) =>
      (old ?? []).filter((m) => m.id !== id),
    );
    try {
      if (temporary) {
        await Promise.all((message?.attachments ?? []).map((attachment) => deleteFile(attachment.id, true).catch(() => undefined)));
      } else {
        await deleteMessageRequest(id);
      }
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'The message could not be deleted.');
      if (!temporary) void queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    }
  };

  return {
    editingMessageId,
    editingMessageText,
    setEditingMessageText,
    handleEditMessage,
    saveEditedMessage,
    cancelEditMessage,
    deleteMessage,
    editError,
    clearEditError: () => setEditError(''),
    exportMessageToMarkdown,
  };
}
