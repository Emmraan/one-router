'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, FileText, AlertTriangle, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sidebar } from '../../components/sidebar';
import { ChatMessageItem } from '../../components/chat-message-item';
import { HeaderBar } from '../../components/header-bar';
import { InputDeck } from '../../components/input-deck';
import { GreetingView } from '../../components/greeting-view';
import { DragOverlay } from '../../components/drag-overlay';
import { FloatingSelectionToolbar } from '../../components/floating-selection-toolbar';
import { ChatActions } from '../../components/chat-actions';
import { TemporaryExitModal } from '../../components/temporary-exit-modal';
import { useChatState } from '../../hooks/use-chat-state';
import { useFileUpload } from '../../hooks/use-file-upload';
import { useStreaming } from '../../hooks/use-streaming';
import { useEnhance } from '../../hooks/use-enhance';
import { useChatEditing } from '../../hooks/use-chat-editing';
import { useTextSelection } from '../../hooks/use-text-selection';
import { useLogout } from '../../hooks/use-auth';
import { LoadingScreen } from '../../components/loading-screen';
import { ConnectionStatus } from '../../components/connection-status';

// Dialogs are opened on demand; keeping them out of the initial route leaves
// room for the NFR-15 JS budget.
const ProviderDashboard = dynamic(
  () =>
    import('../../components/provider-dashboard').then(
      (module) => module.ProviderDashboard,
    ),
  { ssr: false },
);

const DataDialog = dynamic(
  () => import('../../components/data-dialog').then((module) => module.DataDialog),
  { ssr: false },
);
const SettingsPanel = dynamic(() => import('../../components/settings-panel').then((module) => module.SettingsPanel), { ssr: false });

function getFileIcon(_fileName: string, mimeType: string) {
  return mimeType.startsWith('image/') ? <ImageIcon size={14} className="muted" /> : <FileText size={14} className="muted" />;
}

function quoteText(text: string): string {
  return text.split('\n').map((line) => `> ${line}`).join('\n');
}

function Notice({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div role="alert" className="status-notice error-notice flex items-start justify-between gap-3">
      <span className="flex items-start gap-1.5">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        {message}
      </span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 rounded p-0.5 hover:bg-red-500/10 cursor-pointer" aria-label="Dismiss message">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const logoutMutation = useLogout();
  const {
    sidebarOpen, setSidebarOpen, dashboardOpen, setDashboardOpen,
    providers, chats, messages,
    activeChatId, setActiveChatId, activeChat, activeModel, activeProviderId,
    mounted, createNewChat, selectChat,
    deleteChat, renameChat, togglePinChat, selectModelAndProvider,
    temporaryChat, savingTemporary, temporaryError, setTemporaryError,
    createTemporaryChat, saveTemporaryChat, discardTemporaryChat,
    updateTemporaryTitle, pendingNavigation, resolvePendingNavigation,
  } = useChatState();

  const {
    fileInputRef, imageInputRef, uploadMenuRef,
    showUploadMenu, setShowUploadMenu,
    attachmentsBuffer, isDragging, uploadError,
    handleFileUpload, processFiles, removeAttachment, retryAttachment, handlePaste,
    dragHandlers, clearAttachments,
  } = useFileUpload();

  const [inputText, setInputText] = React.useState('');
  const [dataOpen, setDataOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [logoutExitOpen, setLogoutExitOpen] = React.useState(false);

  const {
    enhancing, enhancedPreview, originalPrompt, enhanceError,
    triggerEnhance, applyEnhancedPrompt, discardEnhancedPrompt, undoEnhancedPrompt,
  } = useEnhance(inputText, setInputText, activeProviderId, activeModel);

  const {
    isStreaming, sendError, setSendError, handleSendMessage: streamSend, handleStopStreaming,
  } = useStreaming({
    activeChatId,
    setActiveChatId,
    providers,
    activeModel,
    providerId: activeProviderId,
    onTemporaryTitle: updateTemporaryTitle,
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
    deleteMessage, editError, clearEditError, exportMessageToMarkdown,
  } = useChatEditing({ activeChatId, messages, sendMessage });

  const {
    selectedText, selectionPosition, copiedSelection,
    handleTextSelect, triggerCopySelection,
  } = useTextSelection();

  const quoteMessage = (content: string) => {
    setInputText((prev) => {
      const spacing = prev ? '\n\n' : '';
      return `${prev}${spacing}${quoteText(content)}\n\n`;
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
      return `${prev}${spacing}${quoteText(selectedText)}\n\n`;
    });
  };

  const triggerAskWithQuote = () => {
    if (!selectedText) return;
    setInputText(`Regarding:\n\n"${selectedText}"\n\nCan you explain this?`);
  };

  const activeChatMessages = activeChat ? activeChat.messages : messages;
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0];
  const isTemporaryActive = Boolean(temporaryChat && activeChatId === temporaryChat.id);

  const doLogout = React.useCallback(() => {
    logoutMutation.mutate();
    router.replace('/login');
  }, [logoutMutation, router]);

  const handleLogout = () => {
    if (isTemporaryActive && activeChatMessages.length > 0) {
      setLogoutExitOpen(true);
      return;
    }
    doLogout();
  };

  const saveCurrentTemporary = async () => {
    await saveTemporaryChat({ providerId: activeProviderId, model: activeModel });
  };

  const resolveLogout = async (action: 'save' | 'discard' | 'cancel') => {
    if (action === 'cancel') {
      setLogoutExitOpen(false);
      return;
    }
    if (action === 'save') {
      const saved = await saveTemporaryChat({ providerId: activeProviderId, model: activeModel });
      if (!saved) return;
    } else {
      await discardTemporaryChat();
    }
    setLogoutExitOpen(false);
    doLogout();
  };

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: activeChatMessages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 10,
  });

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  }, [activeChatMessages.length, isStreaming]);

  const renderInputDeck = () => (
    <InputDeck
      inputText={inputText}
      setInputText={setInputText}
      attachments={attachmentsBuffer}
      onRemoveAttachment={removeAttachment}
      onRetryAttachment={retryAttachment}
      onSend={() => sendMessage()}
      onStopStreaming={handleStopStreaming}
      onEnhance={triggerEnhance}
      onPaste={handlePaste}
      isStreaming={isStreaming}
      enhancing={enhancing}
      enhancedPreview={enhancedPreview}
      originalPrompt={originalPrompt}
      enhanceError={enhanceError}
      uploadError={uploadError}
      onApplyEnhanced={applyEnhancedPrompt}
      onDiscardEnhanced={discardEnhancedPrompt}
      onRevertOriginal={undoEnhancedPrompt}
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

  if (!mounted) return <LoadingScreen />;

  return (
    <div className="workspace-frame">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onTogglePin={togglePinChat}
        onSaveTemporary={() => { void saveCurrentTemporary(); }}
        savingTemporary={savingTemporary}
      />

      <main
        className="workspace-main"
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
          activeProviderId={activeProvider?.id || activeProviderId}
          onSelectModelAndProvider={selectModelAndProvider}
          onLogout={handleLogout}
        >
          <ChatActions
            temporary={isTemporaryActive}
            saving={savingTemporary}
            onCreateTemporary={createTemporaryChat}
            onSaveTemporary={() => { void saveCurrentTemporary(); }}
            onDiscardTemporary={() => { void discardTemporaryChat(); }}
            onOpenData={() => setDataOpen(true)}
          />
        </HeaderBar>
        <ConnectionStatus />

        {sendError && <Notice message={sendError} onDismiss={() => setSendError('')} />}
        {editError && <Notice message={editError} onDismiss={clearEditError} />}
        {temporaryError && !pendingNavigation && !logoutExitOpen && (
          <Notice message={temporaryError} onDismiss={() => setTemporaryError('')} />
        )}

        <div className="flex-1 overflow-auto relative flex flex-col">
          {activeChatMessages.length > 0 ? (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden px-6 lg:px-12 py-7 scrollbar-thin relative"
              >
                <div className="w-[46rem] max-w-full mx-auto">
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                      const message = activeChatMessages[virtualItem.index];
                      if (!message) return null;
                      const isEditingThis = editingMessageId === message.id;
                      const isLastBlock = virtualItem.index === activeChatMessages.length - 1;

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

              <div className="transcript-composer">{renderInputDeck()}<p className="text-center text-[11px] muted mt-2">Check important information. Responses come from your selected provider.</p></div>
            </div>
          ) : (
            <GreetingView
              renderInputDeck={renderInputDeck}
              onPresetPrompt={(text) => setInputText(text)}
            />
          )}
        </div>

        {dashboardOpen && <ProviderDashboard
          isOpen={dashboardOpen}
          onClose={() => setDashboardOpen(false)}
          providers={providers}
        />}
        {settingsOpen && <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenData={() => setDataOpen(true)} />}

        {dataOpen && (
          <DataDialog
            isOpen={dataOpen}
            onClose={() => setDataOpen(false)}
            onImported={() => setActiveChatId(null)}
          />
        )}

        <TemporaryExitModal
          isOpen={pendingNavigation !== null}
          saving={savingTemporary}
          error={temporaryError}
          onCancel={() => { void resolvePendingNavigation('cancel'); }}
          onDiscard={() => { void resolvePendingNavigation('discard'); }}
          onSave={() => { void resolvePendingNavigation('save'); }}
        />

        <TemporaryExitModal
          isOpen={logoutExitOpen}
          saving={savingTemporary}
          error={temporaryError}
          onCancel={() => setLogoutExitOpen(false)}
          onDiscard={() => { void resolveLogout('discard'); }}
          onSave={() => { void resolveLogout('save'); }}
        />
      </main>
    </div>
  );
}
