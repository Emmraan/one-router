'use client';

import * as React from 'react';
import { CornerDownLeft } from 'lucide-react';

interface DragOverlayProps {
  isDragging: boolean;
  onFilesDrop: (files: FileList) => void;
  onDragLeaveWorkspace: () => void;
}

export function DragOverlay({ isDragging, onFilesDrop, onDragLeaveWorkspace }: DragOverlayProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDrop(e.dataTransfer.files);
    }
    onDragLeaveWorkspace();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      onDragLeaveWorkspace();
    }
  };

  if (!isDragging) return null;

  return (
    <div
      className="drop-overlay"
      role="status"
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <CornerDownLeft size={32} className="rotate-90" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            Drop files to attach
          </h3>
          <p className="text-sm muted mt-2 max-w-sm leading-relaxed">
            Upload images, PDFs, Markdown, JSON, CSV, or plain text files.
          </p>
        </div>
      </div>
    </div>
  );
}
