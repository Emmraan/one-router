'use client';

import * as React from 'react';
import type { Attachment } from '../lib/provider-types';

export function useFileUpload() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const uploadMenuRef = React.useRef<HTMLDivElement>(null);
  const [showUploadMenu, setShowUploadMenu] = React.useState(false);
  const [attachmentsBuffer, setAttachmentsBuffer] = React.useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);

  const processFiles = (files: FileList | File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      let resolvedType = file.type;
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!resolvedType) {
        if (ext === 'md') resolvedType = 'text/markdown';
        else if (ext === 'txt') resolvedType = 'text/plain';
        else if (ext === 'pdf') resolvedType = 'application/pdf';
        else if (ext === 'docx') resolvedType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === 'doc') resolvedType = 'application/msword';
      }
      if (ext === 'md' && resolvedType === '') {
        resolvedType = 'text/markdown';
      }
      if (!resolvedType) {
        resolvedType = 'application/octet-stream';
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultString = reader.result as string;
        const base64Pure = resultString.includes(';base64,')
          ? resultString.split(';base64,')[1]
          : resultString;

        const attachment: Attachment = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: resolvedType,
          size: file.size,
          url: URL.createObjectURL(file),
          base64: base64Pure,
        };

        setAttachmentsBuffer((prev) => [...prev, attachment]);
      };
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachmentsBuffer((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    }
  };

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        setIsDragging(false);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
  };

  const clearAttachments = () => setAttachmentsBuffer([]);

  return {
    fileInputRef,
    imageInputRef,
    uploadMenuRef,
    showUploadMenu,
    setShowUploadMenu,
    attachmentsBuffer,
    isDragging,
    setIsDragging,
    processFiles,
    handleFileUpload,
    removeAttachment,
    handlePaste,
    dragHandlers,
    clearAttachments,
  };
}
