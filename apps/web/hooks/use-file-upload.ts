'use client';

import * as React from 'react';
import { apiUrl, deleteFile } from '../lib/api';
import type { Attachment } from '../lib/provider-types';

type Upload = { file: File; xhr?: XMLHttpRequest; preview: string; serverId?: string };

export function useFileUpload() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const uploadMenuRef = React.useRef<HTMLDivElement>(null);
  const uploads = React.useRef(new Map<string, Upload>());
  const [showUploadMenu, setShowUploadMenu] = React.useState(false);
  const [attachmentsBuffer, setAttachmentsBuffer] = React.useState<Attachment[]>([]);
  const [uploadError, setUploadError] = React.useState('');
  const [isDragging, setIsDragging] = React.useState(false);

  const upload = React.useCallback((clientId: string) => {
    const entry = uploads.current.get(clientId);
    if (!entry) return;
    const update = (patch: Partial<Attachment>) => setAttachmentsBuffer((old) => old.map((item) => item.clientId === clientId ? { ...item, ...patch } : item));
    update({ status: 'uploading', progress: 0, error: undefined });
    const xhr = new XMLHttpRequest();
    entry.xhr = xhr;
    xhr.open('POST', apiUrl('/api/files'));
    xhr.withCredentials = true;
    xhr.timeout = 60000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) update({ progress: Math.round(event.loaded / event.total * 100) }); };
    xhr.onload = () => {
      let data: { files?: Attachment[]; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* The status still gives a useful failure. */ }
      const stored = data.files?.[0];
      if (xhr.status >= 200 && xhr.status < 300 && stored) {
        if (!uploads.current.has(clientId)) { void deleteFile(stored.id).catch(() => undefined); return; }
        entry.serverId = stored.id;
        update({ ...stored, url: apiUrl(stored.url), status: 'ready', progress: 100 });
      } else update({ status: 'error', error: data.error ?? `Upload failed (${xhr.status}). Retry or remove the file.` });
    };
    xhr.onerror = () => update({ status: 'error', error: 'Upload failed. Check the connection and retry.' });
    xhr.ontimeout = () => update({ status: 'error', error: 'Upload timed out. Retry or remove the file.' });
    const form = new FormData();
    form.set('file', entry.file);
    xhr.send(form);
  }, []);

  const processFiles = React.useCallback((files: FileList | File[]) => {
    setUploadError('');
    const selected = Array.from(files);
    const current = Array.from(uploads.current.values());
    if (selected.length + current.length > 10 || selected.reduce((sum, file) => sum + file.size, 0) + current.reduce((sum, entry) => sum + entry.file.size, 0) > 20 * 1024 * 1024) {
      setUploadError('Choose at most 10 files totalling 20 MB.'); return;
    }
    for (const original of selected) {
      if (!original.size || original.size > 10 * 1024 * 1024) { setUploadError('Each file must be nonempty and at most 10 MB.'); continue; }
      const extension = original.name.split('.').pop()?.toLowerCase() ?? '';
      const inferred: Record<string, string> = { md: 'text/markdown', txt: 'text/plain', csv: 'text/csv', json: 'application/json', pdf: 'application/pdf' };
      const file = original.type ? original : new File([original], original.name, { type: inferred[extension] ?? 'application/octet-stream' });
      const clientId = crypto.randomUUID();
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      uploads.current.set(clientId, { file, preview });
      setAttachmentsBuffer((old) => [...old, { id: clientId, clientId, name: file.name, size: file.size, type: file.type, url: preview, status: 'uploading', progress: 0 }]);
      upload(clientId);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [upload]);

  const release = React.useCallback((clientId: string, discard: boolean) => {
    const entry = uploads.current.get(clientId);
    if (!entry) return;
    uploads.current.delete(clientId);
    entry.xhr?.abort();
    if (entry.preview) URL.revokeObjectURL(entry.preview);
    if (discard && entry.serverId) void deleteFile(entry.serverId, true).catch(() => undefined);
  }, []);
  const removeAttachment = (id: string) => {
    const item = attachmentsBuffer.find((item) => item.id === id);
    if (item?.clientId) release(item.clientId, true);
    setAttachmentsBuffer((old) => old.filter((item) => item.id !== id));
  };
  const clearAttachments = React.useCallback((discard = false) => {
    for (const key of uploads.current.keys()) release(key, discard);
    setAttachmentsBuffer([]);
    setUploadError('');
  }, [release]);
  React.useEffect(() => {
    const entries = uploads.current;
    return () => { for (const key of entries.keys()) release(key, true); };
  }, [release]);
  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => { if (!uploadMenuRef.current?.contains(event.target as Node)) setShowUploadMenu(false); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return {
    fileInputRef, imageInputRef, uploadMenuRef, showUploadMenu, setShowUploadMenu, attachmentsBuffer,
    uploadError, isDragging, setIsDragging, processFiles, clearAttachments, removeAttachment,
    clearUploadError: () => setUploadError(''),
    retryAttachment: (id: string) => { const item = attachmentsBuffer.find((item) => item.id === id); if (item?.clientId) upload(item.clientId); },
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files) processFiles(event.target.files); },
    handlePaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => { if (event.clipboardData.files.length) { event.preventDefault(); processFiles(event.clipboardData.files); } },
    dragHandlers: {
      onDragOver: (event: React.DragEvent) => { event.preventDefault(); setIsDragging(true); },
      onDragEnter: (event: React.DragEvent) => { event.preventDefault(); setIsDragging(true); },
      onDragLeave: (event: React.DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); },
      onDrop: (event: React.DragEvent) => { event.preventDefault(); setIsDragging(false); if (event.dataTransfer.files.length) processFiles(event.dataTransfer.files); },
    },
  };
}
