'use client';

import * as React from 'react';
import { Copy, Check, Download, ChevronDown, ChevronRight } from 'lucide-react';

interface CodeBlockProps {
  lang: string;
  content: string;
  index: number;
  isStreaming?: boolean;
  isLastBlock?: boolean;
}

export function CodeBlock({ lang, content, index, isStreaming, isLastBlock }: CodeBlockProps) {
  const [copiedBlockIndex, setCopiedBlockIndex] = React.useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBlockIndex(index);
    setTimeout(() => setCopiedBlockIndex(null), 2000);
  };

  const handleDownloadCode = (text: string, codeLang: string) => {
    try {
      const ext = codeLang === 'typescript' || codeLang === 'ts' ? 'ts' :
                  codeLang === 'javascript' || codeLang === 'js' ? 'js' :
                  codeLang === 'json' ? 'json' :
                  codeLang === 'html' ? 'html' :
                  codeLang === 'css' ? 'css' :
                  codeLang === 'python' || codeLang === 'py' ? 'py' :
                  codeLang === 'sql' ? 'sql' :
                  codeLang === 'markdown' || codeLang === 'md' ? 'md' : 'txt';
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

  const highlightCode = (code: string, langCode: string = '') => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const normalizedLang = langCode.toLowerCase();
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

    processed = processed.replace(/(\/\/.*|#.*|--.*|\/\*[\s\S]*?\*\/)/g, (match) => {
      return storeToken(`<span class="text-zinc-500 dark:text-zinc-600 font-mono italic select-text">${match}</span>`);
    });

    processed = processed.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (match) => {
      return storeToken(`<span class="text-emerald-600 dark:text-emerald-400 font-mono font-medium select-text">${match}</span>`);
    });

    const keywords = [
      'const', 'let', 'var', 'def', 'class', 'function', 'return', 'if', 'else',
      'for', 'while', 'import', 'export', 'from', 'default', 'as', 'async',
      'await', 'try', 'catch', 'throw', 'new', 'this', 'type', 'interface',
      'enum', 'public', 'private', 'protected', 'yield', 'select', 'where',
      'insert', 'delete', 'update', 'join', 'on',
    ];
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    processed = processed.replace(keywordRegex, '<span class="text-indigo-600 dark:text-rose-400 font-bold select-text">$1</span>');

    const specialTokens = ['true', 'false', 'null', 'undefined', 'void', 'boolean', 'string', 'number', 'any'];
    const specialRegex = new RegExp(`\\b(${specialTokens.join('|')})\\b`, 'g');
    processed = processed.replace(specialRegex, '<span class="text-amber-600 dark:text-amber-400 font-semibold select-text">$1</span>');

    processed = processed.replace(/\b([a-zA-Z_]\w*)(?=\s*\()/g, '<span class="text-indigo-500 dark:text-sky-400 font-bold select-text">$1</span>');

    for (let j = placeholders.length - 1; j >= 0; j--) {
      processed = processed.replace(`___TOKEN_PLACE_HL_${j}___`, placeholders[j]);
    }

    return processed;
  };

  return (
    <div className="relative group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 my-4 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 text-xs text-zinc-500 font-mono select-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition cursor-pointer text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
            title={isCollapsed ? "Expand snippet block" : "Collapse snippet block"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="font-bold text-zinc-650 dark:text-zinc-350 uppercase tracking-wider text-[10px]">{lang}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleDownloadCode(content, lang)}
            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-emerald-400 font-bold transition cursor-pointer text-[11px]"
            title="Download snippet file"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyCode(content)}
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

      {!isCollapsed && (
        <pre className="p-4 overflow-x-auto font-mono text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed scrollbar-thin max-h-[480px] overflow-y-auto select-text">
          <code dangerouslySetInnerHTML={{ __html: highlightCode(content, lang) }} />
          {isStreaming && isLastBlock && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />
          )}
        </pre>
      )}

      {isCollapsed && (
        <div
          onClick={() => setIsCollapsed(false)}
          className="p-3 bg-zinc-100/30 dark:bg-zinc-950/20 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono italic cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-950/40 transition select-none flex items-center justify-between"
        >
          <span>Snippet is currently collapsed (click to expand)</span>
          <span className="font-bold uppercase text-[10px] bg-zinc-250 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
            {content.split('\n').length} lines
          </span>
        </div>
      )}
    </div>
  );
}
