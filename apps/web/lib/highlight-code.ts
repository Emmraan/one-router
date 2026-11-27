import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';

for (const [name, grammar] of Object.entries({ javascript, typescript, python, json, bash, css, xml, sql })) hljs.registerLanguage(name, grammar);
export function highlightCode(content: string, language: string): string | null {
  if (content.length > 20_000 || !hljs.getLanguage(language)) return null;
  try { return hljs.highlight(content, { language, ignoreIllegals: true }).value; }
  catch { return null; }
}
