'use client';

import * as React from 'react';
import { Copy, Check, Quote, Download, ChevronDown, ChevronRight, Sparkles, MessageSquare } from 'lucide-react';

// Tell TypeScript about KaTeX and Mermaid window globals
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

interface MarkdownRendererProps {
  content: string;
  onTextSelect?: (text: string, position: { x: number; y: number } | null) => void;
  isStreaming?: boolean;
}

// Custom hook to load KaTeX dynamically without build conflicts
function useKatex() {
  const [loaded, setLoaded] = React.useState(() => typeof window !== 'undefined' && !!window.katex);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.katex) {
      return;
    }

    // Append Stylesheet
    const linkId = 'katex-cdn-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }

    // Append Script
    const scriptId = 'katex-cdn-js';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      const handleLoad = () => setLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => {
        existingScript.removeEventListener('load', handleLoad);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  return loaded;
}

// Custom hook to load Mermaid dynamically
function useMermaid() {
  const [loaded, setLoaded] = React.useState(() => typeof window !== 'undefined' && !!window.mermaid);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.mermaid) {
      return;
    }

    const scriptId = 'mermaid-cdn-js';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      const handleLoad = () => setLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => {
        existingScript.removeEventListener('load', handleLoad);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
        });
        setLoaded(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  return loaded;
}

// Math expression rendering using KaTeX
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

// Mermaid chart diagrams renderer
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
        setTimeout(() => {
          setErrorFlag(true);
        }, 0);
      });
    } catch (e) {
      console.error('Mermaid render execution failed', e);
      setTimeout(() => {
        setErrorFlag(true);
      }, 0);
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

export function MarkdownRenderer({ content, onTextSelect, isStreaming }: MarkdownRendererProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [copiedBlockIndex, setCopiedBlockIndex] = React.useState<number | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = React.useState<Record<number, boolean>>({});

  const autoCloseMarkdown = (raw: string) => {
    if (!raw) return '';
    let closed = raw;

    const tripleBacktickCount = (closed.match(/```/g) || []).length;
    if (tripleBacktickCount % 2 !== 0) {
      closed += '\n```';
    }

    const cleanForSingle = closed.replace(/```/g, '');
    const singleBacktickCount = (cleanForSingle.match(/`/g) || []).length;
    if (singleBacktickCount % 2 !== 0) {
      closed += '`';
    }

    const boldCount = (closed.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      closed += '**';
    }

    const cleanForItalic = closed.replace(/\*\*/g, '');
    const italicCount = (cleanForItalic.match(/\*/g) || []).length;
    if (italicCount % 2 !== 0) {
      closed += '*';
    }

    return closed;
  };

  const handleSelection = () => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    if (!selection) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const rect = rects[0];
        const containerRect = containerRef.current?.getBoundingClientRect();
        const containerLeft = containerRect?.left || 0;
        const containerTop = containerRect?.top || 0;

        onTextSelect(selectedText, {
          x: rect.left - containerLeft + rect.width / 2,
          y: rect.top - containerTop - 36,
        });
      }
    } else {
      onTextSelect('', null);
    }
  };

  const handleCopyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedBlockIndex(index);
    setTimeout(() => {
      setCopiedBlockIndex(null);
    }, 2000);
  };

  const handleDownloadCode = (text: string, lang: string = 'code', index: number) => {
    try {
      const ext = lang === 'typescript' || lang === 'ts' ? 'ts' :
                  lang === 'javascript' || lang === 'js' ? 'js' :
                  lang === 'json' ? 'json' :
                  lang === 'html' ? 'html' :
                  lang === 'css' ? 'css' :
                  lang === 'python' || lang === 'py' ? 'py' :
                  lang === 'sql' ? 'sql' :
                  lang === 'markdown' || lang === 'md' ? 'md' : 'txt';
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `code_snippet_${index}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to download snippet', e);
    }
  };

  const toggleCollapse = (idx: number) => {
    setCollapsedBlocks((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // High performance syntax highlighter
  const highlightCode = (code: string, lang: string = '') => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const normalizedLang = lang.toLowerCase();
    if (!['javascript', 'typescript', 'js', 'ts', 'jsx', 'tsx', 'json', 'python', 'py', 'bash', 'sh', 'sql', 'html', 'css'].includes(normalizedLang)) {
      return escaped;
    }

    const placeholders: string[] = [];
    const storeToken = (markup: string) => {
      const id = `___TOKEN_PLACE_HL_${placeholders.length}___`;
      placeholders.push(markup);
      return id;
    };

    let processed = escaped;

    // 1. Comments
    processed = processed.replace(/(\/\/.*|#.*|--.*|\/\*[\s\S]*?\*\/)/g, (match) => {
      return storeToken(`<span class="text-zinc-500 dark:text-zinc-600 font-mono italic select-text">${match}</span>`);
    });

    // 2. Strings
    processed = processed.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (match) => {
      return storeToken(`<span class="text-emerald-600 dark:text-emerald-400 font-mono font-medium select-text">${match}</span>`);
    });

    // 3. Regular Keywords
    const keywords = [
      'const', 'let', 'var', 'def', 'class', 'function', 'return', 'if', 'else', 
      'for', 'while', 'import', 'export', 'from', 'default', 'as', 'async', 
      'await', 'try', 'catch', 'throw', 'new', 'this', 'type', 'interface', 
      'enum', 'public', 'private', 'protected', 'yield', 'select', 'where', 
      'insert', 'delete', 'update', 'join', 'on'
    ];
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    processed = processed.replace(keywordRegex, '<span class="text-indigo-600 dark:text-rose-400 font-bold select-text">$1</span>');

    // 4. Constants
    const specialTokens = ['true', 'false', 'null', 'undefined', 'void', 'boolean', 'string', 'number', 'any'];
    const specialRegex = new RegExp(`\\b(${specialTokens.join('|')})\\b`, 'g');
    processed = processed.replace(specialRegex, '<span class="text-amber-600 dark:text-amber-400 font-semibold select-text">$1</span>');

    // 5. Function invocation names
    processed = processed.replace(/\b([a-zA-Z_]\w*)(?=\s*\()/g, '<span class="text-indigo-500 dark:text-sky-400 font-bold select-text">$1</span>');

    // Restore Placeholders
    for (let j = placeholders.length - 1; j >= 0; j--) {
      processed = processed.replace(`___TOKEN_PLACE_HL_${j}___`, placeholders[j]);
    }

    return processed;
  };

  // Format regular inline formatting like bold, italic, inline-code
  const formatInlineText = (text: string) => {
    if (!text) return '';
    let clean = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    clean = clean.replace(/__(.*?)__/g, '<strong>$1</strong>');
    clean = clean.replace(/\*(.*?)\*/g, '<em>$1</em>');
    clean = clean.replace(/_(.*?)_/g, '<em>$1</em>');
    clean = clean.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[12px] text-rose-600 dark:text-rose-450">$1</code>');
    clean = clean.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-emerald-400 hover:underline font-bold">$1</a>');

    return <span dangerouslySetInnerHTML={{ __html: clean }} className="select-text" />;
  };

  // Renders text mixed with inline $ LaTeX math $
  const renderInlineMarkup = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(\$[^\$]+\$)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const mathValue = part.slice(1, -1);
        return <MathRenderer key={pIdx} math={mathValue} block={false} />;
      }
      return formatInlineText(part);
    });
  };

  // Parse raw text package into structured blocks
  const parseMarkdown = (raw: string) => {
    if (!raw) return [];

    const blocks: any[] = [];
    const lines = raw.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Block Math $$ block $$
      if (line.trim().startsWith('$$')) {
        const mathLines: string[] = [];
        let firstContent = line.replace(/^\$\$/, '');
        if (firstContent.trim()) {
          mathLines.push(firstContent);
        }
        i++;
        while (i < lines.length && !lines[i].trim().includes('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().includes('$$')) {
          const lastContent = lines[i].replace(/\$\$/, '');
          if (lastContent.trim()) {
            mathLines.push(lastContent);
          }
          i++;
        }
        blocks.push({
          type: 'math-block',
          content: mathLines.join('\n').trim(),
        });
        continue;
      }

      // Code blocks ```lang
      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim() || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({
          type: 'code',
          lang,
          content: codeLines.join('\n'),
        });
        i++; // skip closing codeblock
        continue;
      }

      // Blockquote >
      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].substring(1).trim());
          i++;
        }
        blocks.push({
          type: 'quote',
          content: quoteLines.join('\n'),
        });
        continue;
      }

      // Unordered list
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
          listItems.push(lines[i].trim().substring(2));
          i++;
        }
        blocks.push({
          type: 'ul',
          items: listItems,
        });
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(line.trim())) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          const match = lines[i].trim().match(/^\d+\.\s+(.*)/);
          if (match) {
            listItems.push(match[1]);
          }
          i++;
        }
        blocks.push({
          type: 'ol',
          items: listItems,
        });
        continue;
      }

      // Table parsing
      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const headers = tableLines[0]
            .split('|')
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map((h) => h.trim());
          
          const rows = tableLines.slice(2).map((rLine) => {
            return rLine
              .split('|')
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
              .map((cell) => cell.trim());
          });

          blocks.push({
            type: 'table',
            headers,
            rows,
          });
          continue;
        }
      }

      // Headers # ## ###
      if (line.startsWith('#')) {
        const headerLevel = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '');
        if (headerLevel <= 6) {
          blocks.push({
            type: 'heading',
            level: headerLevel,
            content: text,
          });
          i++;
          continue;
        }
      }

      // Generic paragraph text
      if (line.trim()) {
        const pLines: string[] = [];
        while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('>') && !lines[i].trim().startsWith('- ') && !lines[i].trim().startsWith('* ') && !/^\d+\.\s+/.test(lines[i].trim())) {
          pLines.push(lines[i]);
          i++;
        }
        blocks.push({
          type: 'p',
          content: pLines.join('  \n'),
        });
        continue;
      }

      i++;
    }

    return blocks;
  };

  const finalizedContent = isStreaming ? autoCloseMarkdown(content) : content;
  const parsedBlocks = parseMarkdown(finalizedContent);

  return (
    <div 
      ref={containerRef} 
      onMouseUp={handleSelection}
      className="space-y-4 text-[14.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 select-text"
    >
      {parsedBlocks.map((block, index) => {
        const isLastBlock = index === parsedBlocks.length - 1;
        
        switch (block.type) {
          case 'heading': {
            const hClass = [
              '',
              'text-2xl font-bold tracking-tight text-zinc-950 dark:text-white pt-2 first:pt-0',
              'text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 pt-1.5 first:pt-0',
              'text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-200 pt-1 first:pt-0',
              'text-base font-semibold text-zinc-800 dark:text-zinc-300',
              'text-sm font-semibold text-zinc-800 dark:text-zinc-300',
              'text-xs font-semibold uppercase text-zinc-500 tracking-wider',
            ][block.level] || 'text-base font-bold';

            const Tag = `h${block.level}` as any;
            return (
              <Tag key={index} className={hClass}>
                {renderInlineMarkup(block.content)}
                {isStreaming && isLastBlock && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
                )}
              </Tag>
            );
          }

          case 'p':
            return (
              <p key={index} className="whitespace-pre-line">
                {renderInlineMarkup(block.content)}
                {isStreaming && isLastBlock && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
                )}
              </p>
            );

          case 'quote':
            return (
              <blockquote key={index} className="pl-4 border-l-3 border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 italic bg-zinc-50/50 dark:bg-zinc-950/20 py-1.5 pr-2.5 rounded-r-lg">
                {block.content.split('\n').map((line: string, qIdx: number, qLines: string[]) => (
                  <p key={qIdx}>
                    {renderInlineMarkup(line)}
                    {isStreaming && isLastBlock && qIdx === qLines.length - 1 && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
                    )}
                  </p>
                ))}
              </blockquote>
            );

          case 'ul':
            return (
              <ul key={index} className="list-disc pl-5.5 space-y-1 my-2">
                {block.items.map((item: string, uIdx: number) => (
                  <li key={uIdx} className="select-text">
                    {renderInlineMarkup(item)}
                    {isStreaming && isLastBlock && uIdx === block.items.length - 1 && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
                    )}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={index} className="list-decimal pl-5.5 space-y-1 my-2">
                {block.items.map((item: string, oIdx: number) => (
                  <li key={oIdx} className="select-text">
                    {renderInlineMarkup(item)}
                    {isStreaming && isLastBlock && oIdx === block.items.length - 1 && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
                    )}
                  </li>
                ))}
              </ol>
            );

          case 'math-block':
            return <MathRenderer key={index} math={block.content} block={true} />;

          case 'table':
            return (
              <div key={index} className="overflow-x-auto border border-zinc-200 dark:border-zinc-805 rounded-xl my-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-mono">
                      {block.headers.map((h: string, hIdx: number) => (
                        <th key={hIdx} className="px-4 py-2.5 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row: string[], rIdx: number) => (
                      <tr key={rIdx} className="border-b last:border-b-0 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/30">
                        {row.map((cell: string, cIdx: number) => (
                          <td key={cIdx} className="px-4 py-2 font-mono text-[12.5px] whitespace-nowrap select-text">{renderInlineMarkup(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'code': {
            if (block.lang.toLowerCase() === 'mermaid') {
              return <MermaidRenderer key={index} code={block.content} />;
            }

            const isCollapsed = collapsedBlocks[index];

            return (
              <div key={index} className="relative group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 my-4 overflow-hidden animate-fade-in">
                {/* Header Actions */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 text-xs text-zinc-500 font-mono select-none">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(index)}
                      className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition cursor-pointer text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                      title={isCollapsed ? "Expand snippet block" : "Collapse snippet block"}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <span className="font-bold text-zinc-650 dark:text-zinc-350 uppercase tracking-wider text-[10px]">{block.lang}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadCode(block.content, block.lang, index)}
                      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-emerald-400 font-bold transition cursor-pointer text-[11px]"
                      title="Download snippet file"
                    >
                      <Download size={13} />
                      <span className="hidden sm:inline">Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(block.content, index)}
                      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-emerald-400 font-bold transition cursor-pointer text-[11px]"
                      title="Copy to clipboard"
                    >
                      {copiedBlockIndex === index ? (
                        <>
                          <Check size={13} className="text-emerald-500" />
                          <span className="text-emerald-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Pre / Highlighted Code Segment */}
                {!isCollapsed && (
                  <pre className="p-4 overflow-x-auto font-mono text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed scrollbar-thin max-h-[480px] overflow-y-auto select-text">
                    <code dangerouslySetInnerHTML={{ __html: highlightCode(block.content, block.lang) }} />
                    {isStreaming && isLastBlock && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
                    )}
                  </pre>
                )}

                {isCollapsed && (
                  <div 
                    onClick={() => toggleCollapse(index)}
                    className="p-3 bg-zinc-100/30 dark:bg-zinc-950/20 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono italic cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-950/40 transition select-none flex items-center justify-between"
                  >
                    <span>Snippet is currently collapsed (click to expand)</span>
                    <span className="font-bold uppercase text-[10px] bg-zinc-250 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                      {block.content.split('\n').length} lines
                    </span>
                  </div>
                )}
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
