'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, putSetting } from '../lib/api';
import { queryKeys } from '../lib/query';
import { applyTheme, normalizeTheme, writeThemeCookie, type Theme } from '../lib/theme';

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: getSettings });
}

// Theme lives in server settings; the cookie is only a first-frame hint. The
// mutation updates the cache and cookie optimistically and rolls back on error.
export function useTheme() {
  const queryClient = useQueryClient();
  const settings = useSettings();
  const theme = normalizeTheme(settings.data?.theme);

  React.useEffect(() => {
    if (settings.data) {
      applyTheme(theme);
      writeThemeCookie(theme);
    }
  }, [settings.data, theme]);

  const mutation = useMutation({
    mutationFn: (next: Theme) => putSetting('theme', next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<Record<string, unknown>>(queryKeys.settings);
      queryClient.setQueryData<Record<string, unknown>>(queryKeys.settings, (old) => ({ ...(old ?? {}), theme: next }));
      applyTheme(next);
      writeThemeCookie(next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.settings, context.previous);
      }
      const fallback = normalizeTheme(context?.previous?.theme);
      applyTheme(fallback);
      writeThemeCookie(fallback);
    },
  });

  const toggleTheme = React.useCallback(() => {
    mutation.mutate(theme === 'dark' ? 'light' : 'dark');
  }, [mutation, theme]);

  return { theme, toggleTheme };
}
