'use client';

import { Database, Save, Timer, Trash2 } from 'lucide-react';

interface ChatActionsProps {
  temporary: boolean;
  saving: boolean;
  onCreateTemporary: () => void;
  onSaveTemporary: () => void;
  onDiscardTemporary: () => void;
  onOpenData: () => void;
}

export function ChatActions({ temporary, saving, onCreateTemporary, onSaveTemporary, onDiscardTemporary, onOpenData }: ChatActionsProps) {
  return <div className="flex items-center gap-2">
    {temporary ? <>
      <span className="muted text-xs hidden lg:inline">Temporary</span>
      <button type="button" className="button primary" onClick={onSaveTemporary} disabled={saving} id="save-temporary-chat" title="Save this temporary chat"><Save size={14} />{saving ? 'Saving...' : 'Save'}</button>
      <button type="button" className="icon-button" onClick={onDiscardTemporary} disabled={saving} id="discard-temporary-chat" aria-label="Discard temporary chat" title="Discard temporary chat"><Trash2 size={16} /></button>
    </> : <button type="button" className="button" onClick={onCreateTemporary} id="new-temporary-chat" title="Start a chat that is not saved"><Timer size={15} /><span>Temporary</span></button>}
    <button type="button" className="icon-button" onClick={onOpenData} id="open-data-dialog" title="Export or import data" aria-label="Data"><Database size={16} /></button>
  </div>;
}
