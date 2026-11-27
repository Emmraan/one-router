'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Check, Download, FileArchive, Lock, Upload,
} from 'lucide-react';
import { Dialog } from '@one-router/ui/dialog';
import {
  exportData, importData, importLegacy, previewImport,
  type ArchiveManifest,
} from '../lib/api';
import { queryKeys } from '../lib/query';
import {
  buildLegacyArchive, clearLegacyKeys, readLegacySnapshot,
  type LegacyArchivePreview, type LegacySnapshot,
} from '../lib/legacy-import';

interface DataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

function Counts({ manifest }: { manifest: ArchiveManifest }) {
  const { counts } = manifest;
  return (
    <dl className="archive-counts">
      {[
        ['Providers', counts.providers],
        ['Chats', counts.chats],
        ['Messages', counts.messages],
        ['Files', counts.attachments],
        ['Settings', counts.settings],
      ].map(([label, value]) => (
        <div key={String(label)}>
          <dt className="muted">{label}</dt>
          <dd className="font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LegacyCounts({ preview }: { preview: LegacyArchivePreview }) {
  const { counts } = preview;
  return (
    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
      {[
        ['providers', counts.providers],
        ['chats', counts.chats],
        ['messages', counts.messages],
        ['files', counts.attachments],
      ].map(([label, value]) => (
        <span key={String(label)} className="muted text-xs">
          {value} {label}
        </span>
      ))}
    </div>
  );
}

export function DataDialog({ isOpen, onClose, onImported }: DataDialogProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<'export' | 'import'>('export');
  const [passphrase, setPassphrase] = React.useState('');
  const [plaintext, setPlaintext] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState('');
  const [exportedName, setExportedName] = React.useState('');

  const [file, setFile] = React.useState<File | null>(null);
  const [importPassphrase, setImportPassphrase] = React.useState('');
  const [previewing, setPreviewing] = React.useState(false);
  const [manifest, setManifest] = React.useState<ArchiveManifest | null>(null);
  const [importMode, setImportMode] = React.useState<'merge' | 'replace'>('merge');
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState('');
  const [imported, setImported] = React.useState<ArchiveManifest | null>(null);

  const [legacy] = React.useState(() => {
    const snapshot = readLegacySnapshot();
    return { snapshot, hasData: snapshot.present.length > 0 };
  });
  const legacySnapshot: LegacySnapshot = legacy.snapshot;
  const [legacyPreview, setLegacyPreview] = React.useState<LegacyArchivePreview | null>(null);
  const [legacyLoading, setLegacyLoading] = React.useState(legacy.hasData);
  const [legacyImporting, setLegacyImporting] = React.useState(false);
  const [legacyError, setLegacyError] = React.useState('');
  const [legacyNotice, setLegacyNotice] = React.useState('');

  React.useEffect(() => {
    if (!legacy.hasData) return;
    let cancelled = false;
    void buildLegacyArchive(legacy.snapshot)
      .then((preview) => { if (!cancelled) setLegacyPreview(preview); })
      .catch((error: unknown) => {
        if (!cancelled) setLegacyError(error instanceof Error ? error.message : 'Browser data could not be read.');
      })
      .finally(() => { if (!cancelled) setLegacyLoading(false); });
    return () => { cancelled = true; };
  }, [legacy]);

  if (!isOpen) return null;

  const handleExport = async (event: React.FormEvent) => {
    event.preventDefault();
    setExportError('');
    setExportedName('');
    if (!plaintext && passphrase.length < 12) {
      setExportError('Use a passphrase of at least 12 characters.');
      return;
    }
    setExporting(true);
    try {
      const result = await exportData(plaintext ? { plaintext: true } : { passphrase });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportedName(result.filename);
      setPassphrase('');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setImportError('');
    setManifest(null);
    setImported(null);
    try {
      const result = await previewImport(file, importPassphrase || undefined);
      setManifest(result.manifest);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The archive could not be read.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !manifest) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await importData(file, importMode, importPassphrase || undefined);
      setImported(result.manifest);
      setManifest(null);
      setFile(null);
      await queryClient.invalidateQueries();
      onImported();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleLegacyImport = async () => {
    if (!legacySnapshot || !legacyPreview) return;
    setLegacyImporting(true);
    setLegacyError('');
    setLegacyNotice('');
    try {
      await importLegacy(legacyPreview.data);
      const notCleared = clearLegacyKeys(legacySnapshot);
      setLegacyNotice(notCleared.length > 0
        ? `Imported. Some browser data changed during import and was kept: ${notCleared.join(', ')}.`
        : 'Browser data imported. The old local copy was removed.');
      setLegacyPreview(null);
      await queryClient.invalidateQueries();
      onImported();
    } catch (error) {
      setLegacyError(error instanceof Error ? error.message : 'Browser data could not be imported.');
    } finally {
      setLegacyImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title="Data" description="Portable encrypted archives." className="data-dialog !max-w-2xl">

          <div className="data-tabs" aria-label="Archive operation">
            {(['export', 'import'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className="button capitalize"
              >
                {value}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto scrollbar-thin p-5 space-y-5">
            {tab === 'export' ? (
              <form onSubmit={handleExport} className="space-y-4">
                <div className="status-notice">
                  <Lock size={16} className="shrink-0" />
                  <p>
                    The archive is encrypted with your passphrase. Provider API keys are included only inside the encrypted file.
                  </p>
                </div>
                <label className="block space-y-1.5">
                  <span className="field-label">Passphrase</span>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    disabled={plaintext}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    className="field"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm muted">
                  <input
                    type="checkbox"
                    checked={plaintext}
                    onChange={(event) => setPlaintext(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Download unencrypted JSON instead. Provider API keys are removed, so imported providers need keys again.
                  </span>
                </label>
                {exportError && (
                  <p role="alert" className="error-notice">{exportError}</p>
                )}
                {exportedName && (
                  <p role="status" className="status-notice">
                    <Check size={12} /> Downloaded {exportedName}.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={exporting}
                  className="button primary"
                >
                  <Download size={13} />
                  {exporting ? 'Preparing...' : plaintext ? 'Download JSON' : 'Download archive'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="field-label" htmlFor="import-archive-file">Archive file</label>
                  <input
                    id="import-archive-file"
                    type="file"
                    accept=".onerouter,.json,application/json"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setManifest(null);
                      setImported(null);
                      setImportError('');
                    }}
                    className="field"
                  />
                  <input
                    type="password"
                    value={importPassphrase}
                    onChange={(event) => setImportPassphrase(event.target.value)}
                    placeholder="Passphrase for encrypted archives"
                    aria-label="Import passphrase"
                    autoComplete="off"
                    className="field"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={!file || previewing}
                    className="button"
                  >
                    <FileArchive size={13} />
                    {previewing ? 'Reading...' : 'Preview archive'}
                  </button>
                </div>

                {manifest && (
                  <div className="space-y-3">
                    <p className="field-label">Archive contents</p>
                    <Counts manifest={manifest} />
                    <fieldset className="space-y-1.5">
                      <legend className="field-label">Import mode</legend>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                        Merge with existing data
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                        Replace all current data
                      </label>
                    </fieldset>
                    {importMode === 'replace' && (
                      <p className="error-notice">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        Replace removes existing chats, providers, settings, and files before importing.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleImport()}
                      disabled={importing}
                      className="button primary"
                    >
                      <Upload size={13} />
                      {importing ? 'Importing...' : importMode === 'replace' ? 'Replace and import' : 'Import archive'}
                    </button>
                  </div>
                )}

                {imported && (
                  <div className="space-y-2">
                    <p role="status" className="status-notice"><Check size={14} /> Import complete.</p>
                    <Counts manifest={imported} />
                  </div>
                )}
                {importError && (
                  <p role="alert" className="error-notice">{importError}</p>
                )}

                <div className="space-y-2 pt-4">
                  <p className="field-label">Browser data from the old app</p>
                  {legacyLoading ? (
                    <p role="status" className="muted text-sm">Checking local browser data...</p>
                  ) : legacyPreview ? (
                    <>
                      <LegacyCounts preview={legacyPreview} />
                      {legacyPreview.skipped.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 muted text-xs">
                          {legacyPreview.skipped.slice(0, 6).map((note) => <li key={note}>{note}</li>)}
                          {legacyPreview.skipped.length > 6 && <li>{legacyPreview.skipped.length - 6} more notes.</li>}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleLegacyImport()}
                        disabled={legacyImporting}
                        className="button"
                      >
                        <Upload size={13} />
                        {legacyImporting ? 'Importing...' : 'Import browser data'}
                      </button>
                    </>
                  ) : legacyNotice ? null : (
                    <p className="muted text-sm">
                      {legacySnapshot.present.length > 0 ? 'Old browser data was found but could not be read.' : 'No old browser data found.'}
                    </p>
                  )}
                  {legacyNotice && <p role="status" className="status-notice">{legacyNotice}</p>}
                  {legacyError && <p role="alert" className="error-notice">{legacyError}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              onClick={onClose}
              className="button"
            >
              Close
            </button>
          </div>
    </Dialog>
  );
}
