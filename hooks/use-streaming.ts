'use client';

import * as React from 'react';
import type { Chat, Message, Attachment, Provider } from '../lib/provider-types';
import { decryptText } from '../lib/crypto';

interface UseStreamingDeps {
  providers: Provider[];
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  activeChatId: string | null;
  setActiveChatId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModel: { providerId: string; model: string } | null;
  isTempMode: boolean;
  setIsTempMode: React.Dispatch<React.SetStateAction<boolean>>;
  renameChat: (id: string, title: string) => void;
}

export function useStreaming(deps: UseStreamingDeps) {
  const {
    providers, chats, setChats, activeChatId, setActiveChatId,
    selectedModel, isTempMode, setIsTempMode, renameChat,
  } = deps;

  const [isStreaming, setIsStreaming] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);

  React.useEffect(() => {
    if (activeChat) {
      setIsTempMode(!!activeChat.isTemporary);
    } else {
      setIsTempMode(false);
    }
  }, [activeChatId, activeChat, setIsTempMode]);

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (
    inputText: string,
    attachmentsBuffer: Attachment[],
    setInputText: (val: string) => void,
    clearAttachments: () => void,
    customPrompt?: string,
    forceRegenerationIndex?: number,
    isUserEditIndex?: number,
  ) => {
    const promptToSend = (customPrompt || inputText).trim();
    if (!promptToSend && attachmentsBuffer.length === 0 && forceRegenerationIndex === undefined && isUserEditIndex === undefined) return;

    const activeProvider = providers.find((p: any) => p.isActive);
    if (!activeProvider) {
      alert('Configure and select an active provider first inside Providers Central.');
      return;
    }

    const activeModel = activeChat ? activeChat.model : (selectedModel?.model || activeProvider.models[0]);
    if (!activeModel) {
      alert('No models found for this provider config.');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);
    setInputText('');

    let currentChat: Chat;

    if (!activeChat) {
      const words = promptToSend.split(/\s+/).slice(0, 10);
      const initialTitle = words.join(' ');
      const newChatId = Math.random().toString(36).substring(7);
      currentChat = {
        id: newChatId,
        title: isTempMode ? 'Ephemeral Private Chat' : initialTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        providerId: activeProvider.id,
        model: activeModel,
        messages: [],
        isTemporary: isTempMode,
        committed: isTempMode,
      };

      setChats((prev) => [currentChat, ...prev]);
      setActiveChatId(newChatId);
    } else {
      currentChat = activeChat;
    }

    let updatedMessages = [...currentChat.messages];

    if (isUserEditIndex !== undefined) {
      const originalMsg = updatedMessages[isUserEditIndex];
      updatedMessages = updatedMessages.slice(0, isUserEditIndex);
      const userMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'user',
        content: promptToSend,
        timestamp: Date.now(),
        attachments: originalMsg?.attachments || [],
      };
      updatedMessages.push(userMessage);
    } else if (forceRegenerationIndex !== undefined) {
      updatedMessages = updatedMessages.slice(0, forceRegenerationIndex);
    } else {
      const userMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'user',
        content: promptToSend,
        timestamp: Date.now(),
        attachments: attachmentsBuffer,
      };
      updatedMessages.push(userMessage);
    }

    clearAttachments();

    const assistantMessageId = Math.random().toString(36).substring(7);
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeModel,
    };

    updatedMessages.push(assistantMessage);

    setChats((prev) => {
      return prev.map((c) => {
        if (c.id === currentChat.id) {
          return { ...c, messages: updatedMessages, updatedAt: Date.now() };
        }
        return c;
      });
    });

    if (currentChat.messages.length === 0 && !currentChat.isTemporary) {
      fetch('/api/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptToSend }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.title) {
            renameChat(currentChat.id, data.title);
          }
        })
        .catch(console.error);
    }

    try {
      const decryptedKey = activeProvider.apiKey ? await decryptText(activeProvider.apiKey) : '';

      const formattedHistory = updatedMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

      const res = await fetch('/api/chat', {
        signal: abortControllerRef.current?.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: activeProvider.baseUrl,
          apiKey: decryptedKey,
          providerType: activeProvider.type,
          model: activeModel,
          messages: formattedHistory,
          customHeaders: activeProvider.customHeaders,
        }),
      });

      if (!res.ok) {
        let errDesc = `Connect issue (${res.status})`;
        try {
          const detail = await res.json();
          errDesc = detail.error || errDesc;
        } catch (e) {}
        throw new Error(errDesc);
      }

      const body = res.body;
      if (!body) throw new Error('Readable stream not ready');

      const reader = body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantResponseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith('data: ')) {
            try {
              const node = JSON.parse(cleanLine.substring(6));
              if (node.error) {
                assistantResponseBuffer += `\n\n*(Error while streaming: ${node.error})*`;
              } else if (node.text) {
                assistantResponseBuffer += node.text;
              }

              setChats((prev) => {
                return prev.map((c) => {
                  if (c.id === currentChat.id) {
                    const messagesCopy = [...c.messages];
                    const targetIdx = messagesCopy.findIndex((m) => m.id === assistantMessageId);
                    if (targetIdx > -1) {
                      messagesCopy[targetIdx] = {
                        ...messagesCopy[targetIdx],
                        content: assistantResponseBuffer,
                      };
                    }
                    return { ...c, messages: messagesCopy, updatedAt: Date.now() };
                  }
                  return c;
                });
              });
            } catch (e) {}
          }
        }
      }

      setChats((prev) => {
        const finalChats = prev.map((c) => {
          if (c.id === currentChat.id) {
            return { ...c, committed: c.committed || !c.isTemporary, updatedAt: Date.now() };
          }
          return c;
        });
        if (!currentChat.isTemporary) {
          localStorage.setItem('onerouter_chats', JSON.stringify(finalChats.filter((fc: Chat) => fc.committed !== false)));
        }
        return finalChats;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Core chat thread crashed:', err);
      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id === currentChat.id) {
            const messagesCopy = [...c.messages];
            const targetIdx = messagesCopy.findIndex((m) => m.id === assistantMessageId);
            if (targetIdx > -1) {
              messagesCopy[targetIdx] = {
                ...messagesCopy[targetIdx],
                content: `⚠️ **Routing Error:** ${err.message || 'The endpoint was unable to complete the instruction pack.'}`,
              };
            }
            return { ...c, messages: messagesCopy, committed: !c.isTemporary, updatedAt: Date.now() };
          }
          return c;
        });
        if (!currentChat.isTemporary) {
          localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter((c: Chat) => c.committed !== false)));
        }
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  return {
    isStreaming,
    handleSendMessage,
    handleStopStreaming,
  };
}
