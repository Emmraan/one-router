'use client';

import { useStaticSearch } from 'fumadocs-core/search/client';
import {
  SearchDialog, SearchDialogClose, SearchDialogContent, SearchDialogHeader, SearchDialogIcon,
  SearchDialogInput, SearchDialogList, SearchDialogOverlay, type SharedProps,
} from 'fumadocs-ui/components/dialog/search';

export default function DocsSearch(props: SharedProps) {
  const { search, onSearchChange, isLoading, data } = useStaticSearch({ from: '/docs/search.json' });

  return (
    <SearchDialog search={search} onSearchChange={onSearchChange} isLoading={isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={data?.items ?? []} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
