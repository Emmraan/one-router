import type { ReactNode } from 'react';
import { Wordmark } from '@one-router/ui/brand';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsProvider } from '../../components/docs-provider';
import { source } from '../../lib/docs-source';
import { repository } from '../../lib/site';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsProvider>
      <DocsLayout tree={source.getPageTree()} nav={{ title: <Wordmark />, url: '/' }}
        githubUrl={repository} sidebar={{ prefetch: false }} themeSwitch={{ enabled: false }}>
        {children}
      </DocsLayout>
    </DocsProvider>
  );
}
