'use client';

import * as React from 'react';
import mermaid from 'mermaid';
import { isSafeDiagramSource } from '../lib/diagram-source';

// Mermaid configuration is global, so concurrent messages must render in order.
let renderQueue: Promise<unknown> = Promise.resolve();
let nextId = 0;

const subscribeTheme = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const getTheme = () => document.documentElement.classList.contains('dark');

export function MermaidRenderer({ code }: { code: string }) {
  const dark = React.useSyncExternalStore(subscribeTheme, getTheme, () => true);
  const [result, setResult] = React.useState<{ source: string; dark: boolean; svg?: string; error?: boolean }>();
  React.useEffect(() => {
    let cancelled = false;
    const task = async () => {
      if (cancelled) return;
      if (!isSafeDiagramSource(code)) {
        setResult({ source: code, dark, error: true }); return;
      }
      const id = `diagram-${++nextId}`;
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
          maxTextSize: 10_000, maxEdges: 100, theme: 'base',
          themeVariables: { darkMode: dark, primaryColor: dark ? '#292929' : '#ffffff',
            primaryBorderColor: dark ? '#606060' : '#b0b0b0', primaryTextColor: dark ? '#f2f2f2' : '#202020',
            lineColor: dark ? '#adadad' : '#606060', edgeLabelBackground: dark ? '#292929' : '#ffffff',
            secondaryColor: dark ? '#323232' : '#f5f5f5', tertiaryColor: dark ? '#323232' : '#f5f5f5' },
          fontFamily: 'Segoe UI, system-ui, sans-serif', flowchart: { htmlLabels: false } });
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) setResult({ source: code, dark, svg });
      } catch { if (!cancelled) setResult({ source: code, dark, error: true }); }
      finally { document.getElementById(`d${id}`)?.remove(); }
    };
    renderQueue = renderQueue.then(task, task);
    return () => { cancelled = true; };
  }, [code, dark]);
  if (result?.source !== code || result.dark !== dark) return <p role="status" className="muted">Drawing diagram…</p>;
  if (result.error) return <div className="status-notice"><p>Diagram could not be drawn. Source:</p><pre>{code.slice(0, 10_000)}</pre></div>;
  return <div data-renderer="diagram" className="diagram-block" dangerouslySetInnerHTML={{ __html: result.svg ?? '' }} />;
}
