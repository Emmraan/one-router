'use client';

import * as React from 'react';
import { Wordmark, NetworkMark } from '@one-router/ui/brand';
import { WorkspaceFrame, Welcome } from '@one-router/ui/workspace';
import { Dialog } from '@one-router/ui/dialog';
import { Plus, Search, Settings, Database, Trash2, ChevronDown, PanelLeftClose, CornerDownLeft, Timer } from 'lucide-react';

const subscribeColorScheme = (notify: () => void) => {
  const query = matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

export function LivePreview() {
  const [appearance, setAppearance] = React.useState('dark');
  const systemDark = React.useSyncExternalStore(subscribeColorScheme, prefersDark, () => true);
  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
  const [sidebar, setSidebar] = React.useState(true);
  const [dialog, setDialog] = React.useState('');
  const [model, setModel] = React.useState('gpt-4o');
  const [prompt, setPrompt] = React.useState('');
  const [sent, setSent] = React.useState('');
  const [temporary, setTemporary] = React.useState(false);
  const submit = () => { if (prompt.trim()) { setSent(prompt.trim()); setPrompt(''); } };
  const composer = <div className="composer"><textarea aria-label="Preview message" placeholder={`Message ${model}…`} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} /><div className="composer-toolbar justify-between"><button className="icon-button" aria-label="Preview attachments" onClick={() => setDialog('Attachments')}><Plus size={18} /></button><div className="flex items-center gap-3"><span className="composer-hint">Shift + Enter for a new line</span><button className="button button-primary" disabled={!prompt.trim()} onClick={submit}>Submit<CornerDownLeft size={13} /></button></div></div></div>;
  return <div className={`live-preview ${dark ? 'dark' : ''}`}>
    <WorkspaceFrame sidebar={<aside className={`app-sidebar ${sidebar ? '' : 'sidebar-collapsed'}`} aria-label="Preview navigation">
      <div className="sidebar-brand">{sidebar ? <Wordmark /> : <NetworkMark width={28} height={28} />}<button className="icon-button" aria-label="Toggle preview sidebar" onClick={() => setSidebar(!sidebar)}><PanelLeftClose size={16} /></button></div>
      <div className="sidebar-tools"><button className="button sidebar-new" aria-label="New preview chat" onClick={() => { setSent(''); setPrompt(''); }}><Plus size={16} />{sidebar && 'New chat'}</button>{sidebar && <label className="sidebar-search"><Search size={14} /><input placeholder="Search chats" aria-label="Search preview chats" /></label>}</div>
      <div className="sidebar-history">{sidebar && <><h2>Recent</h2>{sent ? <button className="sidebar-link w-full truncate">{sent.slice(0, 40)}</button> : <p className="history-empty">Your conversations will appear here.</p>}</>}</div>
      <div className="sidebar-footer">{[[Database, 'Providers'], [Trash2, 'Trash'], [Settings, 'Settings']].map(([Icon, name]) => { const Symbol = Icon as typeof Settings; return <button key={String(name)} className="sidebar-link" onClick={() => setDialog(String(name))} aria-label={`Preview ${name}`}><Symbol size={16} />{sidebar && String(name)}</button>; })}</div>
    </aside>} header={<header className="workspace-header"><button className="model-trigger" onClick={() => setDialog('Choose model')} aria-label={`Choose preview model, ${model}`}><span><span className="block font-semibold">{model}</span><span className="muted block text-[11px]">{model === 'llama3.2' ? 'Ollama' : 'OpenAI'}</span></span><ChevronDown size={13} /></button><button className="button" onClick={() => setTemporary(!temporary)} aria-pressed={temporary}><Timer size={13} />{temporary ? 'Temporary chat' : 'Temporary'}</button></header>}>
      {sent ? <div className="preview-transcript"><p className="muted text-xs mb-2">You</p><p className="preview-user">{sent}</p><div className="flex gap-3 mt-8"><NetworkMark width={26} height={26} /><div><p className="muted text-xs mb-2">{model}</p><p>This preview uses sample replies. In your workspace, the selected provider answers here, with code, equations, and diagrams when needed.</p></div></div><button className="button mt-6" onClick={() => setSent('')}>Back to composer</button></div> : <Welcome onPrompt={setPrompt}>{composer}</Welcome>}
    </WorkspaceFrame>
    <Dialog open={Boolean(dialog)} title={dialog} className={dialog === 'Providers' ? 'dialog-drawer' : undefined} onClose={() => setDialog('')}>
      <div className="dialog-body">{dialog === 'Settings' ? <label className="field-label">Appearance<select className="field mt-2" value={appearance} onChange={(event) => setAppearance(event.target.value)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
        : dialog === 'Choose model' ? <div className="flex flex-col gap-2">{['gpt-4o', 'gpt-4o-mini', 'llama3.2'].map((name) => <button className="button justify-start" key={name} onClick={() => { setModel(name); setDialog(''); }}>{name}</button>)}</div>
        : dialog === 'Providers' ? <><h3 className="font-semibold">Example providers</h3><p className="muted mt-2">OpenAI · 2 models</p><p className="muted mt-2">Ollama · 1 model</p><p className="mt-5">Add endpoints and discover models from Providers in your own workspace.</p></>
        : dialog === 'Attachments' ? <p>Your workspace accepts images, PDF, and text files. File uploads are available in the installed app.</p>
        : <p>No deleted chats in this preview.</p>}</div>
    </Dialog>
  </div>;
}
