'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteMessage as deleteMessageRequest, updateMessage as updateMessageRequest } from '../lib/api';
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
      await updateMessageRequest(message.id, content);
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    }
  };

  const deleteMessage = async (id: string) => {
    if (!activeChatId) return;
    const chatId = activeChatId;
    queryClient.setQueryData<MessageDto[]>(queryKeys.messages(chatId), (old) =>
      (old ?? []).filter((m) => m.id !== id),
    );
    try {
      await deleteMessageRequest(id);
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
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
    exportMessageToMarkdown,
  };
}
