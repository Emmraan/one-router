'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Check, Database, Download, FileArchive, Lock, Upload, X,
} from 'lucide-react';
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
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
      {[
        ['Providers', counts.providers],
        ['Chats', counts.chats],
        ['Messages', counts.messages],
        ['Files', counts.attachments],
        ['Settings', counts.settings],
      ].map(([label, value]) => (
        <div key={String(label)} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 px-2.5 py-1.5">
          <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
          <dd className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{value}</dd>
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
        <span key={String(label)} className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-2 py-1 text-zinc-600 dark:text-zinc-400">
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
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/45 dark:bg-black/65 backdrop-blur-xs" />
      <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
        <div className="bg-white dark:bg-[#0d0d0d] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Database size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Data</h3>
                <p className="text-[10px] font-mono text-zinc-400">Portable encrypted archives</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition"
              aria-label="Close data dialog"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex border-b border-zinc-100 dark:border-zinc-800">
            {(['export', 'import'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition cursor-pointer ${
                  tab === value
                    ? 'border-emerald-500 text-zinc-950 dark:text-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto scrollbar-thin p-5 space-y-5">
            {tab === 'export' ? (
              <form onSubmit={handleExport} className="space-y-4">
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <Lock size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    The archive is encrypted with your passphrase. Provider API keys are included only inside the encrypted file.
                  </p>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-500">Passphrase</span>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    disabled={plaintext}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100"
                  />
                </label>
                <label className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={plaintext}
                    onChange={(event) => setPlaintext(event.target.checked)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    Download unencrypted JSON instead. Provider API keys are removed, so imported providers need keys again.
                  </span>
                </label>
                {exportError && (
                  <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">{exportError}</p>
                )}
                {exportedName && (
                  <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <Check size={12} /> Downloaded {exportedName}.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={exporting}
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-900 disabled:opacity-50 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 cursor-pointer"
                >
                  <Download size={13} />
                  {exporting ? 'Preparing...' : plaintext ? 'Download JSON' : 'Download archive'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-500" htmlFor="import-archive-file">Archive file</label>
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
                    className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-2.5 file:py-1 file:text-[10px] file:font-bold file:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
                  />
                  <input
                    type="password"
                    value={importPassphrase}
                    onChange={(event) => setImportPassphrase(event.target.value)}
                    placeholder="Passphrase for encrypted archives"
                    autoComplete="off"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={!file || previewing}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
                  >
                    <FileArchive size={13} />
                    {previewing ? 'Reading...' : 'Preview archive'}
                  </button>
                </div>

                {manifest && (
                  <div className="space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-500">Archive contents</p>
                    <Counts manifest={manifest} />
                    <fieldset className="space-y-1.5">
                      <legend className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-500">Import mode</legend>
                      <label className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                        <input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="accent-emerald-500" />
                        Merge with existing data
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                        <input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="accent-emerald-500" />
                        Replace all current data
                      </label>
                    </fieldset>
                    {importMode === 'replace' && (
                      <p className="flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-600 dark:text-red-400">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        Replace removes existing chats, providers, settings, and files before importing.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleImport()}
                      disabled={importing}
                      className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-900 disabled:opacity-50 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 cursor-pointer"
                    >
                      <Upload size={13} />
                      {importing ? 'Importing...' : importMode === 'replace' ? 'Replace and import' : 'Import archive'}
                    </button>
                  </div>
                )}

                {imported && (
                  <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"><Check size={12} /> Import complete.</p>
                    <Counts manifest={imported} />
                  </div>
                )}
                {importError && (
                  <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">{importError}</p>
                )}

                <div className="space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-500">Browser data from the old app</p>
                  {legacyLoading ? (
                    <p className="text-[11px] text-zinc-500">Checking local browser data...</p>
                  ) : legacyPreview ? (
                    <>
                      <LegacyCounts preview={legacyPreview} />
                      {legacyPreview.skipped.length > 0 && (
                        <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-amber-700 dark:text-amber-400">
                          {legacyPreview.skipped.slice(0, 6).map((note) => <li key={note}>{note}</li>)}
                          {legacyPreview.skipped.length > 6 && <li>{legacyPreview.skipped.length - 6} more notes.</li>}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleLegacyImport()}
                        disabled={legacyImporting}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-500/15 disabled:opacity-50 dark:text-amber-400 cursor-pointer"
                      >
                        <Upload size={13} />
                        {legacyImporting ? 'Importing...' : 'Import browser data'}
                      </button>
                    </>
                  ) : legacyNotice ? null : (
                    <p className="text-[11px] text-zinc-500">
                      {legacySnapshot.present.length > 0 ? 'Old browser data was found but could not be read.' : 'No old browser data found.'}
                    </p>
                  )}
                  {legacyNotice && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{legacyNotice}</p>}
                  {legacyError && <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">{legacyError}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/20">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-350 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
