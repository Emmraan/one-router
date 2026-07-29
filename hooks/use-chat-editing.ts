'use client';

import * as React from 'react';
import type { Chat } from '../lib/provider-types';

function exportMessageToMarkdown(messageContent: string, messageId: string) {
  try {
    const blob = new Blob([messageContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assistant_message_${messageId}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('Failed to export message', e);
  }
}

export function useChatEditing(
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  handleSendMessage: (text: string, forceRegen?: number, editIndex?: number) => void,
  isStreaming: boolean,
) {
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = React.useState('');

  const handleEditMessage = (msgId: string, text: string) => {
    setEditingMessageId(msgId);
    setEditingMessageText(text);
  };

  const saveEditedMessage = (msgIndex: number, isUserMsg: boolean) => {
    if (!editingMessageText.trim() || isStreaming) return;
    setEditingMessageId(null);

    if (isUserMsg) {
      handleSendMessage(editingMessageText, undefined, msgIndex);
    } else {
      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeChatId) {
            const messagesCopy = [...c.messages];
            if (messagesCopy[msgIndex]) {
              messagesCopy[msgIndex] = {
                ...messagesCopy[msgIndex],
                content: editingMessageText,
              };
            }
            return { ...c, messages: messagesCopy, updatedAt: Date.now() };
          }
          return c;
        });
        localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => c.committed !== false)));
        return updated;
      });
    }
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
  };

  const deleteMessage = (msgId: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id === activeChatId) {
          return {
            ...c,
            messages: c.messages.filter((m) => m.id !== msgId),
            updatedAt: Date.now(),
          };
        }
        return c;
      });
      localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => c.committed !== false)));
      return updated;
    });
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
