'use client';
import * as React from 'react';
import { ChevronLeft, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { ProviderType, PROVIDER_DEFAULTS } from '../../lib/provider-types';

interface ProviderFormProps {
  editingId: string | null;
  formName: string; setFormName: (v: string) => void;
  formType: ProviderType; setFormType: (v: ProviderType) => void;
  formBaseUrl: string; setFormBaseUrl: (v: string) => void;
  formApiKey: string; setFormApiKey: (v: string) => void;
  formModels: string[]; setFormModels: (v: string[]) => void;
  formHeaders: string; setFormHeaders: (v: string) => void;
  validationError: string; isTestingConnection: boolean; saving?: boolean;
  testResult: { success: boolean; message: string; count?: number } | null;
  onClearTestResult: () => void; showKeyRaw: boolean; onToggleKeyVisibility: () => void;
  onTestConnection: () => void; onSave: (e: React.FormEvent) => void; onClose: () => void;
}
export function ProviderForm(props: ProviderFormProps) {
  const { editingId, formName, setFormName, formType, setFormType, formBaseUrl, setFormBaseUrl, formApiKey, setFormApiKey, formModels, setFormModels, formHeaders, setFormHeaders, validationError, isTestingConnection, testResult, onClearTestResult, showKeyRaw, onToggleKeyVisibility, onTestConnection, onSave, onClose, saving } = props;
  return <div className="space-y-4">
    <button className="button" id="form-back-to-list-btn" onClick={onClose}><ChevronLeft size={15} /> Back to providers</button>
    <h3 className="font-semibold text-base">{editingId === 'new' ? 'Add provider' : 'Edit provider'}</h3>
    {validationError && <p className="error-notice" role="alert">{validationError}</p>}
    <form onSubmit={onSave} className="space-y-3">
      <label className="field-label" htmlFor="provider-select-scheme">API format<select className="field" id="provider-select-scheme" value={formType} onChange={(event) => {
        const type = event.target.value as ProviderType; setFormType(type); onClearTestResult();
        if (editingId === 'new') { const defaults = PROVIDER_DEFAULTS[type]; setFormName(defaults.name); setFormBaseUrl(defaults.baseUrl); setFormModels(defaults.models); }
      }}>{(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((type) => <option key={type} value={type}>{type === 'openai' ? 'OpenAI compatible' : PROVIDER_DEFAULTS[type].name}</option>)}</select></label>
      <label className="field-label" htmlFor="provider-input-name">Provider name<input className="field" id="provider-input-name" required maxLength={100} value={formName} onChange={(event) => setFormName(event.target.value)} /></label>
      <label className="field-label" htmlFor="provider-input-url">Base URL<input className="field font-mono" id="provider-input-url" required type="url" value={formBaseUrl} onChange={(event) => setFormBaseUrl(event.target.value)} spellCheck={false} /></label>
      <div><label className="field-label" htmlFor="provider-input-key">API key <span className="muted font-normal">(optional)</span></label><div className="flex gap-2 mt-2"><input className="field font-mono" id="provider-input-key" type={showKeyRaw ? 'text' : 'password'} value={formApiKey} autoComplete="off" onChange={(event) => setFormApiKey(event.target.value)} /><button className="icon-button" type="button" onClick={onToggleKeyVisibility} aria-label={showKeyRaw ? 'Hide API key' : 'Show API key'}>{showKeyRaw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><p className="muted text-xs mt-2">{editingId === 'new' ? 'Required when your provider uses authentication.' : 'Leave blank to keep the stored key.'} Keys are encrypted on the server.</p></div>
      <button type="button" className="button" id="btn-test-connection" disabled={isTestingConnection} onClick={onTestConnection}><RefreshCw size={14} className={isTestingConnection ? 'animate-spin' : ''} />{isTestingConnection ? 'Testing connection...' : 'Test connection'}</button>
      {testResult && <p id="test-connection-result" role={testResult.success ? 'status' : 'alert'} className={testResult.success ? 'status-notice' : 'error-notice'}>{testResult.message}</p>}
      <div><label className="field-label" htmlFor="provider-add-model">Models</label><div className="flex flex-wrap gap-2 my-2 max-h-40 overflow-auto">{formModels.map((model, index) => <span key={`${model}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded border border-[var(--border)] pl-2 font-mono text-xs"><span className="truncate">{model}</span><button className="icon-button !min-h-7 !min-w-7" type="button" aria-label={`Remove model ${model}`} onClick={() => setFormModels(formModels.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div><input className="field" id="provider-add-model" placeholder="Add model..." onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); const value = event.currentTarget.value.trim(); if (value && !formModels.includes(value)) setFormModels([...formModels, value]); event.currentTarget.value = ''; } }} /><p className="muted text-xs mt-2">Press Enter to add a model, or use Test connection to discover models.</p></div>
      <label className="field-label" htmlFor="provider-input-headers">Custom headers <span className="muted font-normal">(optional JSON)</span><textarea className="field font-mono" id="provider-input-headers" rows={2} value={formHeaders} onChange={(event) => setFormHeaders(event.target.value)} placeholder='{ "x-custom-origin": "ONE ROUTER" }' /></label>
      <div className="provider-form-actions"><button className="button" type="button" onClick={onClose}>Cancel</button><button className="button primary" id="btn-save-provider" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save provider'}</button></div>
    </form>
  </div>;
}
