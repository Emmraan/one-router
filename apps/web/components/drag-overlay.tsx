'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-white/70 dark:bg-[#070707]/80 backdrop-blur-xs z-[100] flex flex-col items-center justify-center p-6 border-4 border-dashed border-emerald-500/50 m-4 rounded-3xl"
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 animate-bounce">
              <CornerDownLeft size={36} className="rotate-90 shrink-0 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                Drop files to routing stream
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed font-semibold">
                Upload images, PDFs, word documents, or plain text packages instantly.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
