'use client';

import * as React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function MathRenderer({ math, block = false }: { math: string; block?: boolean }) {
  const html = React.useMemo(() => {
    if (math.length > 10_000) return null;
    try {
      return katex.renderToString(math, { displayMode: block, throwOnError: false, trust: false, strict: 'error', maxExpand: 200, maxSize: 20 });
    } catch { return null; }
  }, [math, block]);
  const Tag = block ? 'div' : 'span';
  return html ? <Tag data-renderer="math" className={block ? 'math-block' : undefined} dangerouslySetInnerHTML={{ __html: html }} />
    : <Tag data-renderer="math">{math}</Tag>;
}
