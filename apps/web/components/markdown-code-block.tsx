'use client';

import * as React from 'react';
import { Copy, Check, Download, ChevronDown, ChevronRight } from 'lucide-react';

export function CodeBlock({ lang, content, index, isStreaming }: { lang: string; content: string; index: number; isStreaming?: boolean }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');
  const [highlight, setHighlight] = React.useState<{ source: string; html: string | null }>();
  React.useEffect(() => {
    if (isStreaming || content.length > 20_000) return;
    let cancelled = false;
    import('../lib/highlight-code').then(({ highlightCode }) => {
      if (!cancelled) setHighlight({ source: content, html: highlightCode(content, lang) });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [content, lang, isStreaming]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Could not copy. Select the code and copy it manually.'); }
  };
  const download = () => {
    const extensions: Record<string, string> = { typescript: 'ts', ts: 'ts', javascript: 'js', js: 'js', python: 'py', py: 'py', json: 'json', html: 'html', css: 'css', sql: 'sql', bash: 'sh' };
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `snippet-${index + 1}.${extensions[lang] ?? 'txt'}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const html = highlight?.source === content ? highlight.html : null;
  return <div className="code-block">
    <div className="code-toolbar"><button type="button" className="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand code' : 'Collapse code'}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{lang}</button>
      <div><button type="button" className="button" onClick={download} aria-label="Download code"><Download size={14} />Download</button><button type="button" className="button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></div>
    </div>
    {!collapsed && <pre>{html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{content}</code>}</pre>}
    {collapsed && <p className="muted px-4 py-2">{content.split('\n').length} lines collapsed</p>}
    {error && <p role="alert" className="error-notice">{error}</p>}
  </div>;
}
