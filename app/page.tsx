'use client';

import * as React from 'react';
import { RefreshCw, Image as ImageIcon, FileText } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sidebar } from '../components/sidebar';
import { ProviderDashboard } from '../components/provider-dashboard';
import { ChatMessageItem } from '../components/chat-message-item';
import { HeaderBar } from '../components/header-bar';
import { InputDeck } from '../components/input-deck';
import { GreetingView } from '../components/greeting-view';
import { DragOverlay } from '../components/drag-overlay';
import { FloatingSelectionToolbar } from '../components/floating-selection-toolbar';
import { useChatState } from '../hooks/use-chat-state';
import { useFileUpload } from '../hooks/use-file-upload';
import { useStreaming } from '../hooks/use-streaming';
import { useEnhance } from '../hooks/use-enhance';
import { useChatEditing } from '../hooks/use-chat-editing';
import { useTextSelection } from '../hooks/use-text-selection';

function getFileIcon(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (mimeType.startsWith('image/')) return <ImageIcon size={14} className="text-indigo-500" />;
  if (mimeType === 'application/pdf' || ext === 'pdf') return <FileText size={14} className="text-red-500" />;
  if (ext === 'docx' || ext === 'doc' || mimeType.includes('word') || mimeType.includes('msword')) return <FileText size={14} className="text-blue-500" />;
  if (ext === 'md' || ext === 'markdown' || mimeType === 'text/markdown') return <FileText size={14} className="text-emerald-500" />;
  return <FileText size={14} className="text-zinc-400 font-bold" />;
}

export default function HomePage() {
  const {
    sidebarOpen, setSidebarOpen, dashboardOpen, setDashboardOpen,
    theme, providers, setProviders, chats, setChats,
    activeChatId, setActiveChatId, selectedModel,
    isTempMode, setIsTempMode, mounted,
    toggleTheme, handleUpdateProviders, createNewChat,
    deleteChat, renameChat, togglePinChat, selectModelAndProvider,
  } = useChatState();

  const {
    fileInputRef, imageInputRef, uploadMenuRef,
    showUploadMenu, setShowUploadMenu,
    attachmentsBuffer, isDragging,
    handleFileUpload, processFiles, removeAttachment, handlePaste,
    dragHandlers, clearAttachments,
  } = useFileUpload();

  const [inputText, setInputText] = React.useState('');

  const {
    enhancing, enhancedPreview, originalPrompt,
    triggerEnhance, applyEnhancedPrompt, discardEnhancedPrompt,
  } = useEnhance(inputText, setInputText);

  const {
    isStreaming, handleSendMessage: streamSend, handleStopStreaming,
  } = useStreaming({
    providers, chats, setChats, activeChatId, setActiveChatId,
    selectedModel, isTempMode, setIsTempMode, renameChat,
  });

  const sendMessage = React.useCallback(
    (customPrompt?: string, forceRegen?: number, editIndex?: number) => {
      streamSend(inputText, attachmentsBuffer, setInputText, clearAttachments, customPrompt, forceRegen, editIndex);
    },
    [streamSend, inputText, attachmentsBuffer, clearAttachments],
  );

  const {
    editingMessageId, editingMessageText, setEditingMessageText,
    handleEditMessage, saveEditedMessage, cancelEditMessage,
    deleteMessage, exportMessageToMarkdown,
  } = useChatEditing(activeChatId, setChats, sendMessage, isStreaming);

  const {
    selectedText, selectionPosition, copiedSelection,
    handleTextSelect, triggerCopySelection,
  } = useTextSelection();

  const quoteMessage = (content: string) => {
    setInputText((prev) => {
      const spacing = prev ? '\n\n' : '';
      return `${prev}${spacing}> ${content}\n\n`;
    });
  };

  const handleRegenerate = (msgIndex: number) => {
    if (isStreaming) return;
    sendMessage(undefined, msgIndex);
  };

  const triggerQuote = () => {
    if (!selectedText) return;
    setInputText((prev) => {
      const spacing = prev ? '\n\n' : '';
      return `${prev}${spacing}> ${selectedText}\n\n`;
    });
  };

  const triggerAskWithQuote = () => {
    if (!selectedText) return;
    setInputText(`Regarding:\n\n"${selectedText}"\n\nCan you explain this?`);
  };

  const handleToggleTempMode = () => {
    if (isTempMode) {
      if (activeChatId) {
        setChats((prev) => {
          const filtered = prev.filter((c) => c.id !== activeChatId);
          return filtered;
        });
        setActiveChatId((prev) => {
          const remaining = chats.filter((c) => c.id !== prev);
          return remaining.length > 0 ? remaining[0].id : null;
        });
      }
      setIsTempMode(false);
    } else {
      createNewChat(true);
    }
  };

  const handlePresetPrompt = (text: string) => {
    setInputText(text);
  };

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeProvider = providers.find((p: any) => p.isActive) || providers[0];
  const activeModel = activeChat ? activeChat.model : (selectedModel?.model || activeProvider?.models?.[0] || '');

  const rowVirtualizer = useVirtualizer({
    count: activeChat ? activeChat.messages.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 10,
  });

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [activeChat?.messages?.length, isStreaming]);

  const renderInputDeck = () => (
    <InputDeck
      inputText={inputText}
      setInputText={setInputText}
      attachments={attachmentsBuffer}
      onRemoveAttachment={removeAttachment}
      onSend={() => sendMessage()}
      onStopStreaming={handleStopStreaming}
      onEnhance={triggerEnhance}
      onPaste={handlePaste}
      isStreaming={isStreaming}
      enhancing={enhancing}
      enhancedPreview={enhancedPreview}
      originalPrompt={originalPrompt}
      onApplyEnhanced={applyEnhancedPrompt}
      onDiscardEnhanced={discardEnhancedPrompt}
      onRevertOriginal={() => { setInputText(originalPrompt); }}
      activeModel={activeModel}
      fileInputRef={fileInputRef}
      imageInputRef={imageInputRef}
      uploadMenuRef={uploadMenuRef}
      showUploadMenu={showUploadMenu}
      setShowUploadMenu={setShowUploadMenu}
      onFileUpload={handleFileUpload}
      getFileIcon={getFileIcon}
    />
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center font-sans">
        <RefreshCw size={24} className="text-indigo-600 animate-spin" />
        <p className="text-xs text-zinc-400 mt-2 font-mono">ONE ROUTER Loading...</p>
      </div>
    );
  }

  return (
    <div className={`flex w-full h-screen overflow-hidden font-sans text-gray-900 bg-zinc-50 dark:bg-[#0a0a0a] dark:text-zinc-300 ${theme}`}>
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

      <div
        className="flex-1 flex flex-col h-full overflow-hidden relative"
        {...dragHandlers}
      >
        <DragOverlay
          isDragging={isDragging}
          onFilesDrop={processFiles}
          onDragLeaveWorkspace={() => {}}
        />

        <HeaderBar
          providers={providers}
          activeModel={activeModel}
          activeProviderId={activeProvider?.id || ''}
          onSelectModelAndProvider={selectModelAndProvider}
          isTempMode={isTempMode}
          onToggleTempMode={handleToggleTempMode}
        />

        <div className="flex-1 overflow-hidden relative flex flex-col bg-zinc-50/50 dark:bg-[#0a0a0a]">
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

                <FloatingSelectionToolbar
                  selectedText={selectedText}
                  selectionPosition={selectionPosition}
                  onAsk={triggerAskWithQuote}
                  onQuote={triggerQuote}
                  onCopy={triggerCopySelection}
                  copied={copiedSelection}
                />
              </div>

              {renderInputDeck()}
            </div>
          ) : (
            <GreetingView
              renderInputDeck={renderInputDeck}
              onPresetPrompt={handlePresetPrompt}
            />
          )}
        </div>

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
