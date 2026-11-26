'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useKatex } from '../hooks/use-katex';
import { useMermaid } from '../hooks/use-mermaid';

export function MathRenderer({ math, block = false }: { math: string; block?: boolean }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isKatexLoaded = useKatex();

  React.useEffect(() => {
    if (!containerRef.current) return;
    if (isKatexLoaded && window.katex) {
      try {
        window.katex.render(math, containerRef.current, {
          displayMode: block,
          throwOnError: false,
        });
      } catch (err) {
        console.error('KaTeX rendering error', err);
        containerRef.current.textContent = (block ? '$$\n' : '$') + math + (block ? '\n$$' : '$');
      }
    } else {
      containerRef.current.textContent = (block ? '$$\n' : '$') + math + (block ? '\n$$' : '$');
    }
  }, [math, block, isKatexLoaded]);

  if (block) {
    return (
      <div
        ref={containerRef}
        className="block my-5 overflow-x-auto p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 rounded-xl font-serif text-center text-emerald-600 dark:text-emerald-400 select-text"
      />
    );
  }

  return (
    <span
      ref={containerRef}
      className="inline-block font-serif text-emerald-600 dark:text-emerald-400 select-text px-0.5 mx-0.5"
    />
  );
}

export function MermaidRenderer({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isMermaidLoaded = useMermaid();
  const [svg, setSvg] = React.useState<string>('');
  const [errorFlag, setErrorFlag] = React.useState(false);

  React.useEffect(() => {
    if (!isMermaidLoaded || !window.mermaid) return;

    const uniqueId = `mermaid-svg-${Math.random().toString(36).substring(7)}`;
    try {
      window.mermaid.render(uniqueId, code).then(({ svg }) => {
        setSvg(svg);
        setErrorFlag(false);
      }).catch((err) => {
        console.error('Mermaid async render failure', err);
        setTimeout(() => setErrorFlag(true), 0);
      });
    } catch (e) {
      console.error('Mermaid render execution failed', e);
      setTimeout(() => setErrorFlag(true), 0);
    }
  }, [code, isMermaidLoaded]);

  if (!isMermaidLoaded) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-805 text-xs font-mono text-zinc-400 animate-pulse gap-2">
        <Sparkles size={16} className="animate-spin text-emerald-500" />
        <span>Synthesizing visual graphs...</span>
      </div>
    );
  }

  if (errorFlag) {
    return (
      <div className="p-4 bg-red-500/5 dark:bg-rose-950/20 border border-red-500/20 rounded-xl text-xs font-mono text-rose-500/80 leading-relaxed">
        <h4 className="font-extrabold uppercase tracking-widest text-[9px] text-rose-500 mb-1">Mermaid Build Error</h4>
        <pre className="overflow-x-auto whitespace-pre-wrap select-text">{code}</pre>
      </div>
    );
  }

  return (
    <div className="my-5 p-5 bg-white dark:bg-zinc-950/60 rounded-2xl border border-zinc-150 dark:border-zinc-850 flex justify-center overflow-x-auto shadow-xs select-none">
      {svg ? (
        <div
          ref={containerRef}
          className="mermaid-rendered-container max-w-full text-zinc-900 dark:text-white"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div ref={containerRef} className="hidden" />
      )}
    </div>
  );
}

declare global {
  interface Window {
    katex?: {
      render: (math: string, element: HTMLElement, options: any) => void;
    };
    mermaid?: {
      initialize: (options: any) => void;
      render: (id: string, text: string) => Promise<{ svg: string }>;
    };
  }
}
