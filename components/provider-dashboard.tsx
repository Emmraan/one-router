'use client';

import * as React from 'react';
import { 
  X, Plus, Trash2, Eye, EyeOff, RefreshCw, Check, Save, Edit, Cpu, Globe, Database, ChevronLeft, Star, Play, Sparkles, ChevronDown
} from 'lucide-react';
import { Provider, ProviderType, PROVIDER_DEFAULTS } from '../lib/provider-types';
import { encryptText, decryptText } from '../lib/crypto';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from './confirm-modal';

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

  // Form State
  const [formName, setFormName] = React.useState('');
  const [formType, setFormType] = React.useState<ProviderType>('openai');
  const [formBaseUrl, setFormBaseUrl] = React.useState('');
  const [formApiKey, setFormApiKey] = React.useState('');
  const [formModels, setFormModels] = React.useState<string[]>([]);
  const [formHeaders, setFormHeaders] = React.useState('');

  const [schemeOpen, setSchemeOpen] = React.useState(false);
  const schemeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (schemeRef.current && !schemeRef.current.contains(e.target as Node)) {
        setSchemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [validationError, setValidationError] = React.useState('');
  
  // Connection Test State inside Form
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string; count?: number } | null>(null);

  // Load a provider into editing form
  const handleEdit = async (provider: Provider) => {
    setEditingId(provider.id);
    setFormName(provider.name);
    setFormType(provider.type);
    setFormBaseUrl(provider.baseUrl);
    setFormModels(provider.models);
    setFormHeaders(provider.customHeaders || '');
    
    // Decrypt key
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

  const validateForm = () => {
    if (!formName.trim()) return 'Name is required';
    if (!formBaseUrl.trim()) return 'Base URL is required';
    return '';
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
        body: JSON.stringify({
          baseUrl: formBaseUrl.trim(),
          apiKey: formApiKey.trim(),
          providerType: formType,
        }),
      });
      const data = await res.json();
      if (data.success && data.models && Array.isArray(data.models)) {
        // Populate the models list with discovered models
        setFormModels(data.models);
        setTestResult({
          success: true,
          message: `Connected successfully! Discovered ${data.models.length} compatible model(s) and populated list below.`,
          count: data.models.length,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection refused or model list unsupported by this endpoint.',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Error occurred during connection/ping test.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }

    const encryptedKey = formApiKey.trim() ? await encryptText(formApiKey.trim()) : '';
    const modelsArray = formModels.filter(Boolean);

    let updatedList: Provider[] = [];

    if (editingId && editingId !== 'new') {
      // Edit existing
      updatedList = providers.map((prov) => {
        if (prov.id === editingId) {
          return {
            ...prov,
            name: formName.trim(),
            type: formType,
            baseUrl: formBaseUrl.trim(),
            apiKey: encryptedKey,
            models: modelsArray.length > 0 ? modelsArray : PROVIDER_DEFAULTS[formType].models,
            customHeaders: formHeaders.trim(),
          };
        }
        return prov;
      });
    } else {
      // Add new
      const newProvider: Provider = {
        id: Math.random().toString(36).substring(7),
        name: formName.trim(),
        type: formType,
        baseUrl: formBaseUrl.trim(),
        apiKey: encryptedKey,
        models: modelsArray.length > 0 ? modelsArray : PROVIDER_DEFAULTS[formType].models,
        customHeaders: formHeaders.trim(),
        isActive: providers.length === 0, // active if it's the first one
      };
      updatedList = [...providers, newProvider];
    }

    onUpdateProviders(updatedList);
    handleCloseForm();
  };

  const executeDelete = (id: string) => {
    const filtered = providers.filter((p) => p.id !== id);
    if (filtered.length > 0 && !filtered.some((p) => p.isActive)) {
      filtered[0].isActive = true;
    }
    onUpdateProviders(filtered);
    if (editingId === id) {
      handleCloseForm();
    }
  };

  const toggleActive = (id: string) => {
    const updated = providers.map((p) => ({
      ...p,
      isActive: p.id === id,
    }));
    onUpdateProviders(updated);
  };

  const discoverModels = async (prov: Provider) => {
    setDiscoveringId(prov.id);
    setDiscoveryError(null);
    try {
      const queryKey = ['provider-models', prov.id, prov.baseUrl];
      const models = await queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const decryptedKey = prov.apiKey ? await decryptText(prov.apiKey) : '';
          const res = await fetch('/api/discovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseUrl: prov.baseUrl,
              apiKey: decryptedKey,
              providerType: prov.type,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Connection refused or model list unsupported by this endpoint.');
          }
          return data.models as string[];
        },
        staleTime: 5 * 1000 * 60, // 5 minutes cache
      });

      if (models && models.length > 0) {
        // Update provider models in stored list
        const updated = providers.map((p) => {
          if (p.id === prov.id) {
            return { ...p, models };
          }
          return p;
        });
        onUpdateProviders(updated);
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
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/45 dark:bg-black/65 backdrop-blur-xs cursor-pointer"
            id="providers-modal-backdrop"
          />

          {/* Right Sliding Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md md:max-w-xl bg-white dark:bg-[#070707] border-l border-zinc-300/40 dark:border-zinc-700/30 shadow-2xl flex flex-col h-full overflow-hidden text-gray-900 dark:text-zinc-200"
            id="providers-right-drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-300/40 dark:border-zinc-700/30 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Database size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 dark:text-white uppercase tracking-wider">Providers Central</h2>
                  <p className="text-[10px] text-zinc-400 font-medium">Manage localized endpoints or remote third-party engines.</p>
                </div>
              </div>
              
              <button 
                type="button" 
                onClick={onClose} 
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 cursor-pointer transition"
                id="drawer-close-btn"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
              
              {/* If editing or adding, show Configuration Form. Otherwise, show list of engines. */}
              {editingId ? (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Back to List Header */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleCloseForm}
                      className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-emerald-500 transition cursor-pointer"
                      id="form-back-to-list-btn"
                    >
                      <ChevronLeft size={15} />
                      <span>Back to provider list</span>
                    </button>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 font-bold text-zinc-500">
                      {editingId === 'new' ? 'NEW' : 'EDIT'}
                    </span>
                  </div>

                  {/* Config Form Title */}
                  <div className="border-b border-zinc-300/40 dark:border-zinc-700/30 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 font-mono">
                      <Cpu size={14} className="animate-pulse" />
                      <span>Configure Engine Node</span>
                    </h3>
                  </div>

                  {validationError && (
                    <div className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
                      {validationError}
                    </div>
                  )}

                  <form onSubmit={handleSave} className="space-y-4">
                    {/* Provider Type - Custom Dropdown */}
                    <div className="flex flex-col gap-1.5 relative">
                      <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">Provider Scheme</label>
                      <div className="relative" ref={schemeRef}>
                        <button
                          type="button"
                          onClick={() => setSchemeOpen(!schemeOpen)}
                          className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 font-semibold flex items-center justify-between cursor-pointer"
                          id="provider-select-scheme"
                        >
                          <span>{formType === 'openai' ? 'OpenAI Compatible' : formType === 'anthropic' ? 'Anthropic Compatible' : formType === 'gemini' ? 'Gemini' : 'Ollama'}</span>
                          <ChevronDown size={14} className={`text-zinc-400 transition-transform ${schemeOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {schemeOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-10 overflow-hidden">
                            {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  setFormType(type);
                                  setSchemeOpen(false);
                                  setTestResult(null);
                                  if (editingId === 'new') {
                                    const defaults = PROVIDER_DEFAULTS[type];
                                    setFormBaseUrl(defaults.baseUrl);
                                    setFormModels(defaults.models);
                                    setFormName(defaults.name);
                                  }
                                }}
                                className={`w-full text-left px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                                  formType === type
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'text-gray-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                }`}
                              >
                                {type === 'openai' ? 'OpenAI Compatible' : type === 'anthropic' ? 'Anthropic Compatible' : type === 'gemini' ? 'Gemini' : 'Ollama'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Provider Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">Provider Name</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. OpenAI Cloud"
                        className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 placeholder:text-zinc-400/80 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                        id="provider-input-name"
                      />
                    </div>

                    {/* Base URL */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">Base url</label>
                      <input
                        type="text"
                        value={formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-950 dark:text-zinc-100 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        id="provider-input-url"
                      />
                    </div>

                    {/* API Secret Key */}
                    <div className="flex flex-col gap-1.5 relative">
                      <div className="flex justify-between items-center gap-1">
                        <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">API Secret Key (Optional)</label>
                        {formType === 'gemini' && (
                          <span className="text-[9px] text-zinc-400 italic">Uses default workspace key if left blank</span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showKeyRaw[editingId] ? 'text' : 'password'}
                          value={formApiKey}
                          onChange={(e) => setFormApiKey(e.target.value)}
                          placeholder={formType === 'ollama' ? 'Optional for local Ollama' : 'Enter API token key'}
                          className="w-full pl-3 pr-10 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          id="provider-input-key"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeyRaw((prev) => ({ ...prev, [editingId]: !prev[editingId] }))}
                          className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-200 transition"
                        >
                          {showKeyRaw[editingId] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Test Connection & Auto Model Discovery Button */}
                    <div className="pt-1.5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleTestFormConnection}
                        disabled={isTestingConnection}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                          isTestingConnection
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500/30'
                        }`}
                        id="btn-test-connection"
                      >
                        <RefreshCw size={13} className={isTestingConnection ? 'animate-spin' : ''} />
                        {isTestingConnection ? 'Testing Connection & Discovering...' : 'Test Connection'}
                      </button>
                      {testResult && (
                        <div 
                          id="test-connection-result" 
                          className={`p-3 rounded-xl border text-[11px] transition duration-200 ${
                            testResult.success
                              ? 'bg-emerald-50/60 border-emerald-205 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                              : 'bg-red-50/60 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <Sparkles size={13} className={testResult.success ? 'text-emerald-500' : 'text-red-400'} />
                            <div className="flex-1">
                              <p className="font-bold">{testResult.success ? 'Auto Discovery Success' : 'Connection Refused'}</p>
                              <p className="opacity-90 mt-0.5 leading-relaxed">{testResult.message}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Models - Tag-based selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">Models</label>
                      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] min-h-[42px]">
                        {formModels.map((model, i) => (
                          <span key={model} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">
                            {model}
                            <button
                              type="button"
                              onClick={() => setFormModels(formModels.filter((_, j) => j !== i))}
                              className="text-zinc-400 hover:text-red-500 cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="Add model..."
                          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 font-mono"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !formModels.includes(val)) {
                                setFormModels([...formModels, val]);
                              }
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Headers TextArea */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono font-mono">Custom Headers (JSON - Optional)</label>
                      <textarea
                        rows={2}
                        value={formHeaders}
                        onChange={(e) => setFormHeaders(e.target.value)}
                        placeholder='{ "x-custom-origin": "ONE ROUTER" }'
                        className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        id="provider-input-headers"
                      />
                    </div>

                    {/* Bottom Save Button Actions */}
                    <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-zinc-300/40 dark:border-zinc-700/30">
                      <button
                        type="button"
                        onClick={handleCloseForm}
                        className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-350 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 transition cursor-pointer"
                        id="btn-save-provider"
                      >
                        <Save size={14} /> 
                        <span>Save Provider</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Title Bar & Add Custom Button */}
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

                  {/* Discovery Errors if any */}
                  {discoveryError && (
                    <div id="discovery-err-banner" className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
                      {discoveryError}
                    </div>
                  )}

                  {/* Main List Stream */}
                  {providers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/30 dark:bg-zinc-950/10">
                      <Database size={24} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                      <p className="text-[11px] text-zinc-450 dark:text-zinc-550 text-center max-w-[280px] leading-relaxed">
                        No custom endpoints active. Build a custom provider container, or run presets.
                      </p>
                      
                      <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[240px]">
                        {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const defaults = PROVIDER_DEFAULTS[type];
                              const newP: Provider = {
                                id: Math.random().toString(36).substring(7),
                                name: defaults.name,
                                type: type,
                                baseUrl: defaults.baseUrl,
                                apiKey: '',
                                models: defaults.models,
                                isActive: providers.length === 0,
                              };
                              onUpdateProviders([...providers, newP]);
                            }}
                            className="text-[10px] font-bold text-left px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
                          >
                            + Populate Preset {PROVIDER_DEFAULTS[type].name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {providers.map((prov) => (
                        <div 
                          key={prov.id} 
                          className={`p-3.5 rounded-xl border transition ${
                            prov.isActive 
                              ? 'bg-emerald-500/5 dark:bg-[#0c0c0c] border-emerald-500/60 shadow-xs' 
                              : 'bg-white dark:bg-[#0c0c0c]/40 border-zinc-300/40 dark:border-zinc-700/30'
                          }`}
                        >
                          <div className="flex items-start justify-between min-w-0 gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={prov.isActive}
                                onChange={() => toggleActive(prov.id)}
                                className="rounded text-emerald-500 accent-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer mt-1"
                                title="Set Active Engine Group"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold flex items-center flex-wrap gap-1.5">
                                  <span>{prov.name}</span>
                                  <span className="text-[8px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/80 text-zinc-500 font-mono uppercase font-bold">
                                    {prov.type}
                                  </span>
                                </p>
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-[200px] md:max-w-[320px]">{prov.baseUrl}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEdit(prov)}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-emerald-500 transition"
                                title="Edit parameters"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => discoverModels(prov)}
                                disabled={discoveringId === prov.id}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-emerald-500 hover:text-emerald-400 disabled:opacity-50 transition cursor-pointer"
                                title="Discover target models"
                              >
                                <RefreshCw size={13} className={discoveringId === prov.id ? 'animate-spin' : ''} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(prov.id)}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#1f1111] text-zinc-400 hover:text-red-500 transition"
                                title="Delete provider"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2.5 pl-6.5 flex flex-wrap gap-1">
                            {prov.models.slice(0, 6).map((m) => (
                              <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-150/80 dark:bg-zinc-900/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                                {m}
                              </span>
                            ))}
                            {prov.models.length > 6 && (
                              <span className="text-[9px] px-1.5 py-0.5 text-zinc-405 font-mono">
                                +{prov.models.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preset Loaders in List View if they want quick ones */}
                  {providers.length > 0 && (
                    <div className="pt-4 border-t border-zinc-300/40 dark:border-zinc-700/30">
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-2 font-mono">Add Presets</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[])
                          .filter(type => !providers.some(p => p.type === type))
                          .map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const defaults = PROVIDER_DEFAULTS[type];
                                const newP: Provider = {
                                  id: Math.random().toString(36).substring(7),
                                  name: defaults.name,
                                  type: type,
                                  baseUrl: defaults.baseUrl,
                                  apiKey: '',
                                  models: defaults.models,
                                  isActive: providers.length === 0,
                                };
                                onUpdateProviders([...providers, newP]);
                              }}
                              className="text-[10px] font-bold text-left px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60 border border-zinc-300/40 dark:border-zinc-700/30 transition flex items-center justify-between"
                            >
                              <span>{PROVIDER_DEFAULTS[type].name.split(' ')[0]}</span>
                              <Plus size={10} className="text-emerald-500" />
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Status Bar */}
            <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-300/40 dark:border-zinc-700/30 text-[10px] text-zinc-450 dark:text-zinc-550 flex justify-between items-center shrink-0 font-mono">
              <span className="flex items-center gap-1">
                <Database size={10} /> Active Provider Groups:
              </span>
              <span className="font-bold text-emerald-500">{providers.length}</span>
            </div>
          </motion.div>
        </>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            executeDelete(deleteConfirmId);
          }
        }}
        title="Delete Provider"
        message="Are you sure you want to delete this provider? This action cannot be undone and all associated models will be removed."
        confirmLabel="Delete"
        variant="danger"
      />
    </AnimatePresence>
  );
}
