'use client';

import * as React from 'react';
import { 
  Send, Sparkles, Image as ImageIcon, FileText, X, Plus, RefreshCw, 
  ChevronRight, CornerDownLeft, Circle, ChevronDown, Check, ArrowRight,
  Zap, Copy, ArrowDownRight, Compass, MessageSquare, Trash2, Edit, Ghost, ShieldAlert, Quote, Download, Square 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sidebar } from '../components/sidebar';
import { ProviderDashboard } from '../components/provider-dashboard';
import { MarkdownRenderer } from '../components/markdown-renderer';
import { ModelSelector } from '../components/model-selector';
import { ChatMessageItem } from '../components/chat-message-item';
import { Chat, Message, Provider, Attachment, ProviderType, PROVIDER_DEFAULTS } from '../lib/provider-types';
import { decryptText } from '../lib/crypto';

export default function HomePage() {
  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('onerouter_sidebar_open') !== 'false';
  });
  React.useEffect(() => {
    localStorage.setItem('onerouter_sidebar_open', String(sidebarOpen));
  }, [sidebarOpen]);
  const [dashboardOpen, setDashboardOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  // Database States
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);

  // Transient Session States
  const [isTempMode, setIsTempMode] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState<{ providerId: string; model: string } | null>(null);
  const [inputText, setInputText] = React.useState('');
  const [originalPrompt, setOriginalPrompt] = React.useState('');
  const [enhancedPreview, setEnhancedPreview] = React.useState<string | null>(null);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [enhancing, setEnhancing] = React.useState(false);

  // File Upload State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [showUploadMenu, setShowUploadMenu] = React.useState(false);
  const uploadMenuRef = React.useRef<HTMLDivElement>(null);
  const [attachmentsBuffer, setAttachmentsBuffer] = React.useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const inputTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Floating selection tools state
  const [selectedText, setSelectedText] = React.useState('');
  const [selectionPosition, setSelectionPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [copiedSelection, setCopiedSelection] = React.useState(false);

  // Inline user edit state
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = React.useState('');

  // Hydration sync
  const [mounted, setMounted] = React.useState(false);

  // Initialization & Mounting hydration
  React.useEffect(() => {
    setMounted(true);

    // 1. Theme Configuration
    const savedTheme = localStorage.getItem('onerouter_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('dark');
      localStorage.setItem('onerouter_theme', 'dark');
      document.documentElement.classList.add('dark');
    }

    // 2. Providers Setup
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
      // Create defaults
      loadedProviders = [
        {
          id: 'p-openai',
          name: 'OpenAI Direct',
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
          isActive: true,
        },
        {
          id: 'p-gemini',
          name: 'Gemini AI Studio',
          type: 'gemini',
          baseUrl: 'https://generativelanguage.googleapis.com',
          models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
          isActive: false,
        },
        {
          id: 'p-ollama',
          name: 'Ollama local',
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          models: ['llama3', 'mistral', 'gemma'],
          isActive: false,
        }
      ];
      localStorage.setItem('onerouter_providers', JSON.stringify(loadedProviders));
    }
    setProviders(loadedProviders);

    // 3. Chats History Setup
    const savedChats = localStorage.getItem('onerouter_chats');
    if (savedChats) {
      try {
        const loadedChats = JSON.parse(savedChats);
        // Remove temporary chats from storage (they shouldn't have been stored anyway, but ensure safety)
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

  // Clear floating tooltips on outer workspace clicks
  React.useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      setSelectedText('');
      setSelectionPosition(null);
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  // Sync scroll to bottom when message log expands
  const activeChat = chats.find((c) => c.id === activeChatId);

  const rowVirtualizer = useVirtualizer({
    count: activeChat ? activeChat.messages.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 10,
  });

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [activeChat?.messages?.length, isStreaming]);

  React.useEffect(() => {
    const el = inputTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [inputText]);

  // Synchronize dynamic temporary state flags whenever activeChat changes
  React.useEffect(() => {
    if (activeChat) {
      setIsTempMode(!!activeChat.isTemporary);
    } else {
      setIsTempMode(false);
    }
  }, [activeChatId, activeChat]);

  // Handle Provider Dashboard updates
  const handleUpdateProviders = (newProviders: Provider[]) => {
    setProviders(newProviders);
    localStorage.setItem('onerouter_providers', JSON.stringify(newProviders));
  };

  // Toggle dark/light theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('onerouter_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  // Create a brand new session
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
    // Non-temp chats: don't add to state yet — shown only after first response

    setActiveChatId(tempMode ? newChat.id : newChat.id);
    setInputText('');
    setAttachmentsBuffer([]);
  };

  // Delete chat dialogue
  const deleteChat = (id: string) => {
    const filtered = chats.filter((c) => c.id !== id);
    setChats(filtered);
    localStorage.setItem('onerouter_chats', JSON.stringify(filtered.filter(c => c.committed !== false)));

    if (activeChatId === id) {
      if (filtered.length > 0) {
        setActiveChatId(filtered[0].id);
      } else {
        setActiveChatId(null);
      }
    }
  };

  // Rename Title
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

  // Pin / Unpin Chat
  const togglePinChat = (id: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return { ...c, isPinned: !c.isPinned };
        }
        return c;
      });
      localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => !c.isTemporary)));
      return updated;
    });
  };

  // Get appropriate icon for attachments based on extension or mime type
  const getFileIcon = (fileName: string, mimeType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={14} className="text-indigo-500" />;
    }
    
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return <FileText size={14} className="text-red-500" />;
    }
    
    if (ext === 'docx' || ext === 'doc' || mimeType.includes('word') || mimeType.includes('msword')) {
      return <FileText size={14} className="text-blue-500" />;
    }
    
    if (ext === 'md' || ext === 'markdown' || mimeType === 'text/markdown') {
      return <FileText size={14} className="text-emerald-500" />;
    }
    
    return <FileText size={14} className="text-zinc-400 font-bold" />;
  };

  // Convert files to base64
  const processFiles = (files: FileList | File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Determine file type precisely, falling back to extension fallback mapping
      let resolvedType = file.type;
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!resolvedType) {
        if (ext === 'md') resolvedType = 'text/markdown';
        else if (ext === 'txt') resolvedType = 'text/plain';
        else if (ext === 'pdf') resolvedType = 'application/pdf';
        else if (ext === 'docx') resolvedType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === 'doc') resolvedType = 'application/msword';
      }
      if (ext === 'md' && resolvedType === '') {
        resolvedType = 'text/markdown';
      }
      if (!resolvedType) {
        resolvedType = 'application/octet-stream';
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultString = reader.result as string;
        // Strip data header to get pure base64 for APIs
        const base64Pure = resultString.includes(';base64,') 
          ? resultString.split(';base64,')[1] 
          : resultString;

        const attachment: Attachment = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: resolvedType,
          size: file.size,
          url: URL.createObjectURL(file),
          base64: base64Pure,
        };

        setAttachmentsBuffer((prev) => [...prev, attachment]);
      };
    }
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachmentsBuffer((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  // Support paste files directly
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    }
  };

  const handleTextSelect = (text: string, position: { x: number; y: number } | null) => {
    setSelectedText(text);
    setSelectionPosition(position);
  };

  // Quote Action
  const triggerQuote = () => {
    if (!selectedText) return;
    setInputText((prev) => {
      const spacing = prev ? '\n\n' : '';
      return `${prev}${spacing}> ${selectedText}\n\n`;
    });
    // clear selection
    setSelectedText('');
    setSelectionPosition(null);
  };

  // Ask AI Segment
  const triggerAskWithQuote = () => {
    if (!selectedText) return;
    const query = `Regarding:\n\n"${selectedText}"\n\nCan you explain this?`;
    setInputText(query);
    setSelectedText('');
    setSelectionPosition(null);
  };

  // Copy Action
  const triggerCopySelection = () => {
    if (!selectedText) return;
    navigator.clipboard.writeText(selectedText);
    setCopiedSelection(true);
    setTimeout(() => {
      setCopiedSelection(false);
      setSelectedText('');
      setSelectionPosition(null);
    }, 1000);
  };

  // Prompt Enhancer
  const triggerEnhance = async () => {
    if (!inputText.trim()) return;
    setEnhancing(true);
    setEnhancedPreview(null);
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputText }),
      });
      const data = await res.json();
      if (data.enhanced) {
        setEnhancedPreview(data.enhanced);
      }
    } catch (e) {
      console.error('Enhancer request failed', e);
    } finally {
      setEnhancing(false);
    }
  };

  const applyEnhancedPrompt = () => {
    if (enhancedPreview) {
      setOriginalPrompt(inputText);
      setInputText(enhancedPreview);
      setEnhancedPreview(null);
    }
  };

  const discardEnhancedPrompt = () => {
    setEnhancedPreview(null);
  };

  // Main submission pipeline
  const handleSendMessage = async (customPrompt?: string, forceRegenerationIndex?: number, isUserEditIndex?: number) => {
    const promptToSend = (customPrompt || inputText).trim();
    if (!promptToSend && attachmentsBuffer.length === 0 && forceRegenerationIndex === undefined && isUserEditIndex === undefined) return;

    // Determine current routing config
    const activeProvider = providers.find((p) => p.isActive);
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

    // Instantiate chat if non-existent or fresh
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

      setChats((prev) => {
        const nextChats = [currentChat, ...prev];
        // Don't persist to localStorage yet — wait until first response completes
        return nextChats;
      });
      setActiveChatId(newChatId);
    } else {
      currentChat = activeChat;
    }

    // Prepare message log
    let updatedMessages = [...currentChat.messages];

    if (isUserEditIndex !== undefined) {
      // ChatGPT style user edit: delete everything from this index onwards
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
      // Regenerating assistant response at forceRegenerationIndex
      updatedMessages = updatedMessages.slice(0, forceRegenerationIndex);
    } else {
      // Append user prompt action
      const userMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'user',
        content: promptToSend,
        timestamp: Date.now(),
        attachments: attachmentsBuffer,
      };
      updatedMessages.push(userMessage);
    }

    // Clear buffer
    setAttachmentsBuffer([]);

    // Insert loading placeholder for assistant
    const assistantMessageId = Math.random().toString(36).substring(7);
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '', // starts empty
      timestamp: Date.now(),
      model: activeModel,
    };

    updatedMessages.push(assistantMessage);

    // Update main state list immediately
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id === currentChat.id) {
          return { ...c, messages: updatedMessages, updatedAt: Date.now() };
        }
        return c;
      });
      return updated;
    });

    // Auto-rename title if it's the first standard thread message
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
      // Decrypt authorization token
      const decryptedKey = activeProvider.apiKey ? await decryptText(activeProvider.apiKey) : '';

      // Set up standard and system prompts
      const formattedHistory = updatedMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

      // Initiate stream fetch
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

              // Fast state update
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

      // Commit finalized log to DB
      setChats((prev) => {
        const finalChats = prev.map((c) => {
          if (c.id === currentChat.id) {
            return { ...c, committed: c.committed || !c.isTemporary, updatedAt: Date.now() };
          }
          return c;
        });
        if (!currentChat.isTemporary) {
          localStorage.setItem('onerouter_chats', JSON.stringify(finalChats.filter(fc => !fc.isTemporary)));
        }
        return finalChats;
      });

    } catch (err: any) {
      console.error('Core chat thread crashed:', err);
      // Log error notice directly inside assistant bubble
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
      localStorage.setItem('onerouter_chats', JSON.stringify(updated.filter(c => c.committed !== false)));
        }
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Handle message regeneration
  const handleRegenerate = (msgIndex: number) => {
    // msgIndex is the Assistant index. We want to clear from msgIndex onwards and recreate the query
    if (isStreaming) return;
    handleSendMessage(undefined, msgIndex);
  };

  // General Message Editing
  const handleEditMessage = (msgId: string, text: string) => {
    setEditingMessageId(msgId);
    setEditingMessageText(text);
  };

  const saveEditedMessage = (msgIndex: number, isUserMsg: boolean) => {
    if (!editingMessageText.trim() || isStreaming) return;

    setEditingMessageId(null);

    if (isUserMsg) {
      // ChatGPT style user edit: delete everything after, fork thread, resend
      handleSendMessage(editingMessageText, undefined, msgIndex);
    } else {
      // In-place edit of assistant message
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

  const quoteMessage = (content: string) => {
    setInputText((prev) => {
      const spacing = prev ? '\n\n' : '';
      return `${prev}${spacing}> ${content}\n\n`;
    });
  };

  const exportMessageToMarkdown = (messageContent: string, messageId: string) => {
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
  };

  const selectModelAndProvider = (providerId: string, model: string) => {
    setSelectedModel({ providerId, model });

    // 1. Update providers list to set this provider active
    setProviders((prev) => {
      const updated = prev.map((p) => ({
        ...p,
        isActive: p.id === providerId,
      }));
      localStorage.setItem('onerouter_providers', JSON.stringify(updated));
      return updated;
    });

    // 2. If there is an active chat, update its providerId and model
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

  // Preset prompts clicked
  const handlePresetPrompt = (text: string) => {
    setInputText(text);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center font-sans">
        <RefreshCw size={24} className="text-indigo-600 animate-spin" />
        <p className="text-xs text-zinc-400 mt-2 font-mono">ONE ROUTER Loading...</p>
      </div>
    );
  }

  const activeProvider = providers.find((p) => p.isActive) || providers[0];
  const activeModel = activeChat ? activeChat.model : (selectedModel?.model || activeProvider?.models?.[0] || '');

  const renderInputDeck = () => {
    return (
      <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col p-2.5 text-left w-[42rem] mx-auto mb-8" onClick={(e) => e.stopPropagation()}>
        
        {/* Attachment Previews row */}
        {attachmentsBuffer.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 font-mono text-[11px]">
            {attachmentsBuffer.map((att) => (
              <div 
                key={att.id} 
                className="flex items-center gap-1.5 p-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 text-xs text-zinc-600 dark:text-zinc-300 font-semibold animate-fade-in"
              >
                {att.type.startsWith('image/') ? (
                  <img 
                    src={att.url} 
                    alt={att.name} 
                    className="w-8 h-8 object-cover rounded-sm" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getFileIcon(att.name, att.type)
                )}
                <span className="max-w-[100px] truncate">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-850 text-zinc-400 hover:text-red-500 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="relative flex items-center">
          <textarea
            ref={inputTextareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 200) + 'px';
              el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
              // Check for Ctrl+z or Cmd+z to revert to original prompt
              if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (originalPrompt) {
                  e.preventDefault();
                  setInputText(originalPrompt);
                  setOriginalPrompt('');
                }
              }
            }}
            onPaste={handlePaste}
            placeholder={`Send a package to ${activeModel || 'playground'}... (Shift+Enter for multi-line)`}
            rows={1}
            className="w-full bg-transparent border-0 outline-none focus:ring-0 text-sm p-3 pr-12 text-gray-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none font-sans"
          />

          {inputText.trim() && (
            <button
              type="button"
              onClick={triggerEnhance}
              disabled={enhancing}
              className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition cursor-pointer flex items-center justify-center animate-fade-in shrink-0"
              title="Enhance prompt with AI (✨)"
              id="textarea-enhance-icon"
            >
              <span className="text-sm select-none leading-none">✨</span>
            </button>
          )}
        </div>

        {/* Saved feedback warning to revert */}
        {originalPrompt && !enhancedPreview && (
          <div className="flex items-center justify-between mx-2.5 mt-1.5 mb-1 px-3 py-1.5 bg-emerald-500/5 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl text-[11px] text-zinc-500 font-mono animate-fade-in animate-duration-150">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-400">
              <span className="text-emerald-500 animate-pulse">✨</span>
              <span>Prompt enhanced. Want to revert?</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setInputText(originalPrompt);
                setOriginalPrompt('');
              }}
              className="font-bold text-indigo-600 dark:text-emerald-450 hover:underline cursor-pointer"
            >
              Undo (Ctrl+Z)
            </button>
          </div>
        )}

        {/* Proposal design preview panel */}
        {enhancedPreview && (
          <div className="mx-2.5 my-2.5 p-3.5 bg-emerald-500/5 dark:bg-[#0c0c0c] border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex flex-col gap-2.5 animate-fade-in shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span>✨</span>
                <span>Optimized AI Prompt proposal</span>
              </span>
              <span className="text-[9px] text-zinc-400 lowercase font-mono">Provider-Independent</span>
            </div>
            
            <div className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-350 max-h-[140px] overflow-y-auto select-text font-serif bg-zinc-50/50 dark:bg-zinc-950/20 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-900 scrollbar-thin">
              {enhancedPreview}
            </div>

            <div className="flex items-center justify-end gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={discardEnhancedPrompt}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-bold cursor-pointer transition text-[11px]"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={applyEnhancedPrompt}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-emerald-500 dark:text-black font-extrabold hover:bg-zinc-900 dark:hover:bg-emerald-405 cursor-pointer transition flex items-center gap-1 text-[11px]"
              >
                <Check size={12} />
                <span>Use Enhanced Version</span>
              </button>
            </div>
          </div>
        )}

        {/* Actions & Buttons inside prompt footer card */}
        <div className="flex items-center justify-between px-3 border-t border-zinc-100 dark:border-zinc-800/60 pt-2.5 text-zinc-400">
          <div className="flex items-center gap-1.5 relative" ref={uploadMenuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowUploadMenu(!showUploadMenu); }}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-350 cursor-pointer transition"
              title="Attach files"
            >
              <Plus size={18} />
            </button>

            {showUploadMenu && (
              <div className="absolute bottom-full left-0 mb-3 -translate-x-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg rounded-xl p-1 min-w-[140px] z-[100] animate-fade-in">
                <button
                  type="button"
                  onClick={() => { imageInputRef.current?.click(); setShowUploadMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                >
                  <ImageIcon size={14} className="text-indigo-500" />
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); setShowUploadMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                >
                  <FileText size={14} className="text-amber-500" />
                  Upload File
                </button>
              </div>
            )}

            <input
              type="file"
              ref={imageInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*"
              multiple
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.md,.pdf,.txt,.docx,.doc"
              multiple
            />
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStreaming}
                className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 hover:bg-red-500/30 transition cursor-pointer"
                title="Stop response"
              >
                <div className="w-3.5 h-3.5 bg-red-500 rounded-xs"></div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() && attachmentsBuffer.length === 0}
                className="h-8 px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-[#111111] dark:hover:bg-[#151515] lg:dark:bg-emerald-500 lg:dark:hover:bg-emerald-400 lg:dark:text-black text-white dark:text-zinc-200 text-xs font-bold border border-zinc-200 dark:border-zinc-800 transition flex items-center gap-1.5 disabled:opacity-45 cursor-pointer"
              >
                <span>Submit</span>
                <CornerDownLeft size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex w-full h-screen overflow-hidden font-sans text-gray-900 bg-zinc-50 dark:bg-[#0a0a0a] dark:text-zinc-300 ${theme}`}>
      
      {/* Structural Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
        onOpenDashboard={() => setDashboardOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        isTempMode={isTempMode}
        onTogglePin={togglePinChat}
      />

      {/* Main Workspace Frame */}
      <div 
        className="flex-1 flex flex-col h-full overflow-hidden relative"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            setIsDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
          }
        }}
      >
        
        {/* Full-screen drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/70 dark:bg-[#070707]/80 backdrop-blur-xs z-[100] flex flex-col items-center justify-center p-6 border-4 border-dashed border-emerald-500/50 m-4 rounded-3xl"
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processFiles(e.dataTransfer.files);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 animate-bounce">
                  <CornerDownLeft size={36} className="rotate-90 shrink-0 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">Drop files to routing stream</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed font-semibold">
                    Upload images, PDFs, word documents, or plain text packages instantly.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Hub Navigation Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-50 transition-colors">
          <div className="flex items-center gap-3">
            {activeProvider && (
              <ModelSelector
                providers={providers}
                activeModel={activeModel}
                activeProviderId={activeProvider.id}
                onSelectModelAndProvider={selectModelAndProvider}
              />
            )}
          </div>

          {/* Right side - Temporary mode toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
               onClick={() => {
                  if (isTempMode) {
                    if (activeChatId) {
                      const filtered = chats.filter((c) => c.id !== activeChatId);
                      setChats(filtered);
                      if (filtered.length > 0) {
                        setActiveChatId(filtered[0].id);
                      } else {
                        setActiveChatId(null);
                      }
                    }
                    setIsTempMode(false);
                  } else {
                    createNewChat(true);
                  }
                }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition cursor-pointer ${
                isTempMode
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
              id="temporary-mode-toggle"
            >
              <Ghost size={12} className={isTempMode ? 'animate-bounce text-amber-500' : ''} />
              <span>Temporary</span>
            </button>
          </div>
        </header>

        {/* Workspace Central Board */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-zinc-50/50 dark:bg-[#0a0a0a]">
          
          {/* Messages Flow view */}
          {activeChat && activeChat.messages.length > 0 ? (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-12 py-8 scroll-smooth scrollbar-thin relative"
              >
                <div className="w-[54rem] mx-auto">
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const message = activeChat.messages[virtualItem.index];
                    if (!message) return null;
                    const isEditingThis = editingMessageId === message.id;
                    const isLastBlock = virtualItem.index === activeChat.messages.length - 1;

                    return (
                      <ChatMessageItem
                        key={message.id}
                        measureRef={rowVirtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                        message={message}
                        index={virtualItem.index}
                        isEditingThis={isEditingThis}
                        editingMessageText={editingMessageText}
                        setEditingMessageText={setEditingMessageText}
                        cancelEditMessage={cancelEditMessage}
                        saveEditedMessage={saveEditedMessage}
                        activeModel={activeModel}
                        isStreaming={isStreaming}
                        isLastBlock={isLastBlock}
                        handleTextSelect={handleTextSelect}
                        handleEditMessage={handleEditMessage}
                        deleteMessage={deleteMessage}
                        quoteMessage={quoteMessage}
                        handleRegenerate={handleRegenerate}
                        exportMessageToMarkdown={exportMessageToMarkdown}
                        getFileIcon={getFileIcon}
                      />
                    );
                  })}
                </div>
                </div>

                {/* Floating selection bubble toolkit */}
                {selectedText && selectionPosition && (
                  <div 
                    className="absolute bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl shadow-xl flex items-center p-1.5 gap-1.5 z-50 animate-scale-up"
                    style={{ left: selectionPosition.x, top: selectionPosition.y }}
                    onClick={(e) => e.stopPropagation()}
                    id="floating-selection-toolbar"
                  >
                    <button
                      type="button"
                      onClick={triggerAskWithQuote}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer"
                      title="Ask AI about this highlighted passage"
                    >
                      <Sparkles size={13} className="text-emerald-500 animate-pulse" />
                      <span>Ask</span>
                    </button>
                    <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />
                    <button
                      type="button"
                      onClick={triggerQuote}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer"
                      title="Quote selection as blockquote block"
                    >
                      <Quote size={13} className="text-indigo-500" />
                      <span>Quote</span>
                    </button>
                    <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />
                    <button
                      type="button"
                      onClick={triggerCopySelection}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer"
                      title="Copy selected snippet to clipboard"
                    >
                      {copiedSelection ? (
                        <>
                          <Check size={13} className="text-emerald-500" />
                          <span className="text-emerald-500 font-extrabold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-zinc-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Input card - fixed at bottom */}
              {renderInputDeck()}
            </div>
          ) : (
            
            /* Blank/Greeting Workspace View (Greeting State) */
            <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center justify-center relative scrollbar-thin">
              <div className="w-full max-w-2xl flex flex-col text-center items-center gap-8 animate-fade-in my-auto">
                
                {/* Visual Swiss Branding */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded bg-emerald-500 flex items-center justify-center text-black text-2xl font-mono font-black scale-95 shadow-md">
                    1R
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight mt-5 text-zinc-950 dark:text-white sm:text-4xl">
                    ONE ROUTER Central
                  </h1>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-450 max-w-md mt-2 leading-relaxed">
                    How Can I Help Your Today?
                  </p>
                </div>

                {/* Input card centered in greeting view */}
                <motion.div layoutId="input-card" transition={{ type: "spring", stiffness: 220, damping: 26 }} className="w-full max-w-2xl z-20">
                  {renderInputDeck()}
                </motion.div>

                {/* Grid of suggest prompt cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full mt-4">
                  {[
                    { title: 'VPS Deployment Steps', desc: 'Detail step-by-step instructions to deploy Next.js and Postgres containers on a VPS.' },
                    { title: 'Docker Compose Configurator', desc: 'Create a local Docker Compose script holding Node, Postgres, and Redis nodes.' },
                    { title: 'Clean Architecture Pattern', desc: 'Explain domain-driven structure separation inside React typescript environments.' },
                    { title: 'Magic Prompt Improver', desc: 'Optimize structural descriptions to provide high details for code modeling.' },
                  ].map((p, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handlePresetPrompt(p.desc)}
                      className="p-4 rounded-2xl border bg-white dark:bg-[#0d0d0d] hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/60 text-left transition duration-200 cursor-pointer select-none group"
                    >
                      <span className="text-xs font-semibold flex items-center justify-between text-zinc-800 dark:text-zinc-200 font-sans group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
                        {p.title}
                        <ArrowDownRight size={14} className="opacity-0 group-hover:opacity-100 transition duration-200 translate-x-1 text-emerald-500" />
                      </span>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-relaxed truncate">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Global Dashboard Modal overlay */}
        <ProviderDashboard 
          isOpen={dashboardOpen}
          onClose={() => setDashboardOpen(false)}
          providers={providers}
          onUpdateProviders={handleUpdateProviders}
        />

      </div>
    </div>
  );
}
