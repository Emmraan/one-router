'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Dialog } from '@one-router/ui/dialog';
import { Provider, ProviderType, PROVIDER_DEFAULTS } from '../lib/provider-types';
import { discoverModels as discoverRequest } from '../lib/api';
import { useCreateProvider, useDeleteProvider, useUpdateProvider } from '../hooks/use-providers';
import { ConfirmModal } from './confirm-modal';
import { ProviderForm } from './provider-dashboard/provider-form';
import { ProviderList } from './provider-dashboard/provider-list';

interface ProviderDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
}

export function ProviderDashboard({ isOpen, onClose, providers }: ProviderDashboardProps) {
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();

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

  // The server never returns stored keys or headers, so the edit form starts
  // blank and an omitted field means "keep the current value".
  const handleEdit = (provider: Provider) => {
    setEditingId(provider.id);
    setFormName(provider.name);
    setFormType(provider.type);
    setFormBaseUrl(provider.baseUrl);
    setFormModels(provider.models);
    setFormApiKey('');
    setFormHeaders('');
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
      const data = await discoverRequest({
        baseUrl: formBaseUrl.trim(),
        apiKey: formApiKey.trim() || undefined,
        providerType: formType,
      });
      if (data.success && Array.isArray(data.models)) {
        setFormModels(data.models);
        setTestResult({
          success: true,
          message: `Connected successfully. Discovered ${data.models.length} compatible model(s) and populated the list below.`,
          count: data.models.length,
        });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection refused or model list unsupported by this endpoint.' });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error occurred during connection test.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formName.trim()) { setValidationError('Name is required'); return; }
    if (!formBaseUrl.trim()) { setValidationError('Base URL is required'); return; }
    setValidationError('');

    const models = formModels.filter(Boolean);
    const chosenModels = models.length > 0 ? models : PROVIDER_DEFAULTS[formType].models;
    const key = formApiKey.trim();
    const headers = formHeaders.trim() || undefined;

    try {
      if (editingId && editingId !== 'new') {
        await updateProvider.mutateAsync({
          id: editingId,
          patch: {
            name: formName.trim(),
            type: formType,
            baseUrl: formBaseUrl.trim(),
            models: chosenModels,
            customHeaders: headers,
            ...(key ? { apiKey: key } : {}),
          },
        });
      } else {
        await createProvider.mutateAsync({
          id: crypto.randomUUID(),
          name: formName.trim(),
          type: formType,
          baseUrl: formBaseUrl.trim(),
          apiKey: key || undefined,
          models: chosenModels,
          customHeaders: headers,
          isActive: providers.length === 0,
        });
      }
      handleCloseForm();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Unable to save the provider.');
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await deleteProvider.mutateAsync(id);
    } catch {
      setDiscoveryError('Could not delete the provider. Try again.');
    }
    if (editingId === id) handleCloseForm();
  };

  const handleDiscover = async (provider: Provider) => {
    setDiscoveringId(provider.id);
    setDiscoveryError(null);
    try {
      const data = await discoverRequest({ providerId: provider.id });
      if (!data.success) throw new Error(data.error || 'Connection refused or model list unsupported by this endpoint.');
      const models = data.models ?? [];
      if (models.length > 0) {
        await updateProvider.mutateAsync({ id: provider.id, patch: { models } });
      }
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Error occurred during connection.');
    } finally {
      setDiscoveringId(null);
    }
  };

  const handleSetActive = async (provider: Provider) => {
    try {
      await Promise.all(
        providers.map((current) => {
          const shouldBeActive = current.id === provider.id;
          if (current.isActive === shouldBeActive) return Promise.resolve();
          return updateProvider.mutateAsync({ id: current.id, patch: { isActive: shouldBeActive } });
        }),
      );
    } catch {
      setDiscoveryError('Could not change the default provider. Try again.');
    }
  };

  const handleAddPreset = async (type: ProviderType) => {
    const defaults = PROVIDER_DEFAULTS[type];
    try {
      await createProvider.mutateAsync({
        id: crypto.randomUUID(),
        name: defaults.name,
        type,
        baseUrl: defaults.baseUrl,
        models: defaults.models,
        isActive: providers.length === 0,
      });
    } catch {
      setDiscoveryError('Could not add the preset. Try again.');
    }
  };

  return (
    <>
          <Dialog open={isOpen} onClose={onClose} title="Providers" description="Connect your models and choose a default provider." className="dialog-drawer" id="providers-right-drawer">
            <div className="dialog-body space-y-5">
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
                  saving={createProvider.isPending || updateProvider.isPending}
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
                  <div className="flex items-center justify-between pb-3">
                    <h3 className="font-semibold">Your providers <span className="muted ml-1">{providers.length}</span></h3>
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
                      className="button primary"
                      id="btn-add-provider-trigger"
                    >
                      <Plus size={14} /> Add provider
                    </button>
                  </div>
                  <ProviderList
                    providers={providers}
                    onEdit={handleEdit}
                    onDiscover={handleDiscover}
                    onDelete={(id) => setDeleteConfirmId(id)}
                    onSetActive={handleSetActive}
                    onAddPreset={handleAddPreset}
                    discoveringId={discoveringId}
                    discoveryError={discoveryError}
                  />
                </>
              )}
            </div>

            <div className="dialog-footer !justify-start muted text-xs">Provider keys stay encrypted on your server.</div>
          </Dialog>
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) void executeDelete(deleteConfirmId); }}
        title="Delete Provider"
        message="Are you sure you want to delete this provider? This action cannot be undone and all associated models will be removed."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
