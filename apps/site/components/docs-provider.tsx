'use client';

import { lazy, type ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';

const SearchDialog = lazy(() => import('./docs-search'));

export function DocsProvider({ children }: { children: ReactNode }) {
  return <RootProvider theme={{ enabled: false }} search={{ SearchDialog }}>{children}</RootProvider>;
}
