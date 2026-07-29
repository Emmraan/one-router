'use client';

import * as React from 'react';
import { X, Database, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { Provider, ProviderType, PROVIDER_DEFAULTS } from '../lib/provider-types';
import { encryptText, decryptText } from '../lib/crypto';
import { ConfirmModal } from './confirm-modal';
import { ProviderForm } from './provider-dashboard/provider-form';
import { ProviderList } from './provider-dashboard/provider-list';

interface ProviderDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  onUpdateProviders: (newProviders: Provider[]) => void;
}

export function ProviderDashboard({ isOpen, onClose, providers, onUpdateProviders }: ProviderDashboardProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showKeyRaw, setShowKeyRaw] = React.useState<Record<string, boolean>>({});
  const [discoveringId, setDiscoveringId] = React.useState<string | null>(null);
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const [formName, setFormName] = React.useState('');
  const [formType, setFormType] = React.useState<ProviderType>('openai');
  const [formBaseUrl, setFormBaseUrl] = React.useState('');
  const [formApiKey, setFormApiKey] = React.useState('');
  const [formModels, setFormModels] = React.useState<string[]>([]);
  const [formHeaders, setFormHeaders] = React.useState('');
  const [validationError, setValidationError] = React.useState('');
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string; count?: number } | null>(null);

  const handleEdit = async (provider: Provider) => {
    setEditingId(provider.id);
    setFormName(provider.name);
    setFormType(provider.type);
    setFormBaseUrl(provider.baseUrl);
    setFormModels(provider.models);
    setFormHeaders(provider.customHeaders || '');
    if (provider.apiKey) {
      try {
        const decrypted = await decryptText(provider.apiKey);
        setFormApiKey(decrypted);
      } catch (e) {
        console.error('Failed to decrypt api key:', e);
        setFormApiKey('');
      }
    } else {
      setFormApiKey('');
    }
    setValidationError('');
    setTestResult(null);
  };

  const handleCloseForm = () => {
    setEditingId(null);
    setFormName('');
    setFormApiKey('');
    setFormModels([]);
    setFormHeaders('');
    setValidationError('');
    setTestResult(null);
  };

  const handleTestFormConnection = async () => {
    if (!formBaseUrl.trim()) {
      setValidationError('Base URL is required to test connection.');
      return;
    }
    setIsTestingConnection(true);
    setTestResult(null);
    setValidationError('');
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: formBaseUrl.trim(), apiKey: formApiKey.trim(), providerType: formType }),
      });
      const data = await res.json();
      if (data.success && data.models && Array.isArray(data.models)) {
        setFormModels(data.models);
        setTestResult({ success: true, message: `Connected successfully! Discovered ${data.models.length} compatible model(s) and populated list below.`, count: data.models.length });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection refused or model list unsupported by this endpoint.' });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Error occurred during connection/ping test.' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setValidationError('Name is required'); return; }
    if (!formBaseUrl.trim()) { setValidationError('Base URL is required'); return; }

    const encryptedKey = formApiKey.trim() ? await encryptText(formApiKey.trim()) : '';
    const modelsArray = formModels.filter(Boolean);
    let updatedList: Provider[];

    if (editingId && editingId !== 'new') {
      updatedList = providers.map((prov) =>
        prov.id === editingId
          ? { ...prov, name: formName.trim(), type: formType, baseUrl: formBaseUrl.trim(), apiKey: encryptedKey, models: modelsArray.length > 0 ? modelsArray : PROVIDER_DEFAULTS[formType].models, customHeaders: formHeaders.trim() }
          : prov
      );
    } else {
      updatedList = [...providers, {
        id: Math.random().toString(36).substring(7),
        name: formName.trim(),
        type: formType,
        baseUrl: formBaseUrl.trim(),
        apiKey: encryptedKey,
        models: modelsArray.length > 0 ? modelsArray : PROVIDER_DEFAULTS[formType].models,
        customHeaders: formHeaders.trim(),
        isActive: providers.length === 0,
      }];
    }
    onUpdateProviders(updatedList);
    handleCloseForm();
  };

  const executeDelete = (id: string) => {
    const filtered = providers.filter((p) => p.id !== id);
    if (filtered.length > 0 && !filtered.some((p) => p.isActive)) filtered[0].isActive = true;
    onUpdateProviders(filtered);
    if (editingId === id) handleCloseForm();
  };

  const discoverModels = async (prov: Provider) => {
    setDiscoveringId(prov.id);
    setDiscoveryError(null);
    try {
      const models = await queryClient.fetchQuery({
        queryKey: ['provider-models', prov.id, prov.baseUrl],
        queryFn: async () => {
          const decryptedKey = prov.apiKey ? await decryptText(prov.apiKey) : '';
          const res = await fetch('/api/discovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseUrl: prov.baseUrl, apiKey: decryptedKey, providerType: prov.type }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Connection refused or model list unsupported by this endpoint.');
          return data.models as string[];
        },
        staleTime: 5 * 1000 * 60,
      });
      if (models && models.length > 0) {
        onUpdateProviders(providers.map((p) => p.id === prov.id ? { ...p, models } : p));
      }
    } catch (e: any) {
      setDiscoveryError(e.message || 'Error occurred during connection.');
    } finally {
      setDiscoveringId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/45 dark:bg-black/65 backdrop-blur-xs cursor-pointer" id="providers-modal-backdrop" />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md md:max-w-xl bg-white dark:bg-[#070707] border-l border-zinc-300/40 dark:border-zinc-700/30 shadow-2xl flex flex-col h-full overflow-hidden text-gray-900 dark:text-zinc-200"
            id="providers-right-drawer"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-300/40 dark:border-zinc-700/30 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><Database size={16} /></div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 dark:text-white uppercase tracking-wider">Providers Central</h2>
                  <p className="text-[10px] text-zinc-400 font-medium">Manage localized endpoints or remote third-party engines.</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 cursor-pointer transition" id="drawer-close-btn"><X size={15} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
              {editingId ? (
                <ProviderForm
                  editingId={editingId}
                  formName={formName} setFormName={setFormName}
                  formType={formType} setFormType={setFormType}
                  formBaseUrl={formBaseUrl} setFormBaseUrl={setFormBaseUrl}
                  formApiKey={formApiKey} setFormApiKey={setFormApiKey}
                  formModels={formModels} setFormModels={setFormModels}
                  formHeaders={formHeaders} setFormHeaders={setFormHeaders}
                  validationError={validationError}
                  isTestingConnection={isTestingConnection}
                  testResult={testResult}
                  showKeyRaw={!!editingId && !!showKeyRaw[editingId]}
                  onToggleKeyVisibility={() => setShowKeyRaw((prev) => ({ ...prev, [editingId!]: !prev[editingId!] }))}
                  onClearTestResult={() => setTestResult(null)}
                  onTestConnection={handleTestFormConnection}
                  onSave={handleSave}
                  onClose={handleCloseForm}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-zinc-300/40 dark:border-zinc-700/30 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Connected Engine Groups</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId('new');
                        setFormName('Custom OpenAI API');
                        setFormType('openai');
                        setFormBaseUrl('https://api.openai.com/v1');
                        setFormApiKey('');
                        setFormModels(['gpt-4o', 'gpt-4o-mini']);
                        setFormHeaders('');
                        setValidationError('');
                        setTestResult(null);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-zinc-955 text-white hover:bg-zinc-900 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 transition cursor-pointer shadow-xs"
                      id="btn-add-provider-trigger"
                    >
                      <Plus size={13} /> Add Provider
                    </button>
                  </div>
                  <ProviderList
                    providers={providers}
                    onUpdateProviders={onUpdateProviders}
                    onEdit={handleEdit}
                    onDiscover={discoverModels}
                    onDelete={(id) => setDeleteConfirmId(id)}
                    discoveringId={discoveringId}
                    discoveryError={discoveryError}
                  />
                </>
              )}
            </div>

            <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-300/40 dark:border-zinc-700/30 text-[10px] text-zinc-450 dark:text-zinc-550 flex justify-between items-center shrink-0 font-mono">
              <span className="flex items-center gap-1"><Database size={10} /> Active Provider Groups:</span>
              <span className="font-bold text-emerald-500">{providers.length}</span>
            </div>
          </motion.div>
        </>
      )}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { executeDelete(deleteConfirmId); } }}
        title="Delete Provider"
        message="Are you sure you want to delete this provider? This action cannot be undone and all associated models will be removed."
        confirmLabel="Delete"
        variant="danger"
      />
    </AnimatePresence>
  );
}
