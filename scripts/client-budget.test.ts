import { describe, expect, it } from 'vitest';
import { auditClientSources } from './client-budget.mjs';

describe('client source budgets', () => {
  it.each(['katex', 'mermaid', 'highlight.js/lib/core', 'motion/react'])('rejects static %s through a transitive import', (dependency) => {
    const files = { 'apps/web/app/page.tsx': "import { Render } from '../components/render';", 'apps/web/components/render.tsx': `import renderer from '${dependency}';` };
    expect(auditClientSources(files, ['apps/web/app/page.tsx']).ok).toBe(false);
  });
  it('allows local dynamic imports and lazy package dependencies', () => {
    expect(auditClientSources({ 'apps/web/app/page.tsx': "const Lazy = dynamic(() => import('../components/render'));", 'apps/web/components/render.tsx': "import mermaid from 'mermaid';" }, ['apps/web/app/page.tsx']).ok).toBe(true);
  });
  it.each(['https://cdn.jsdelivr.net/npm/katex', 'https://unpkg.com/mermaid', 'next/font/google'])('rejects runtime remote assets: %s', (source) => {
    expect(auditClientSources({ 'apps/web/app/page.tsx': source }, ['apps/web/app/page.tsx']).ok).toBe(false);
  });
});
