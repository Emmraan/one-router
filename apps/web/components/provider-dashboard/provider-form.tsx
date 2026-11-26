'use client';

import * as React from 'react';
import { X, ChevronLeft, Eye, EyeOff, RefreshCw, Sparkles, Save, Cpu, ChevronDown } from 'lucide-react';
import { ProviderType, PROVIDER_DEFAULTS } from '../../lib/provider-types';

interface ProviderFormProps {
  editingId: string | null;
  formName: string; setFormName: (v: string) => void;
  formType: ProviderType; setFormType: (v: ProviderType) => void;
  formBaseUrl: string; setFormBaseUrl: (v: string) => void;
  formApiKey: string; setFormApiKey: (v: string) => void;
  formModels: string[]; setFormModels: (v: string[]) => void;
  formHeaders: string; setFormHeaders: (v: string) => void;
  validationError: string;
  isTestingConnection: boolean;
  testResult: { success: boolean; message: string; count?: number } | null;
  onClearTestResult: () => void;
  showKeyRaw: boolean;
  onToggleKeyVisibility: () => void;
  onTestConnection: () => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function ProviderForm({
  editingId, formName, setFormName, formType, setFormType,
  formBaseUrl, setFormBaseUrl, formApiKey, setFormApiKey,
  formModels, setFormModels, formHeaders, setFormHeaders,
  validationError, isTestingConnection, testResult,
  onClearTestResult, showKeyRaw, onToggleKeyVisibility,
  onTestConnection, onSave, onClose,
}: ProviderFormProps) {
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

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
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

      <form onSubmit={onSave} className="space-y-4">
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
                      onClearTestResult();
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

        <div className="flex flex-col gap-1.5 relative">
          <div className="flex justify-between items-center gap-1">
            <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">API Secret Key (Optional)</label>
            {formType === 'gemini' && (
              <span className="text-[9px] text-zinc-400 italic">Uses default workspace key if left blank</span>
            )}
          </div>
          <div className="relative">
            <input
              type={showKeyRaw ? 'text' : 'password'}
              value={formApiKey}
              onChange={(e) => setFormApiKey(e.target.value)}
              placeholder={formType === 'ollama' ? 'Optional for local Ollama' : 'Enter API token key'}
              className="w-full pl-3 pr-10 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              id="provider-input-key"
            />
            <button
              type="button"
              onClick={onToggleKeyVisibility}
              className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-200 transition"
            >
              {showKeyRaw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="pt-1.5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onTestConnection}
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

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">Custom Headers (JSON - Optional)</label>
          <textarea
            rows={2}
            value={formHeaders}
            onChange={(e) => setFormHeaders(e.target.value)}
            placeholder='{ "x-custom-origin": "ONE ROUTER" }'
            className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            id="provider-input-headers"
          />
        </div>

        <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-zinc-300/40 dark:border-zinc-700/30">
          <button
            type="button"
            onClick={onClose}
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
  );
}
