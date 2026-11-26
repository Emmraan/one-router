import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
import type { AuthStatus } from './api-types';

export const queryKeys = {
  auth: ['auth'] as const,
  chats: ['chats'] as const,
  messages: (chatId: string) => ['messages', chatId] as const,
  providers: ['providers'] as const,
  settings: ['settings'] as const,
};

// A 401 from any request means the session is gone, so the cached status is
// rewritten and the auth gate redirects. A forced-change 403 flips the flag.
// Mutations need the same treatment; otherwise an expired session only surfaces
// as a failed save.
export function createQueryClient(): QueryClient {
  const handleAuthError = (error: unknown) => {
    if (!(error instanceof ApiError)) return;
    if (error.status === 401) {
      client.setQueryData<AuthStatus>(queryKeys.auth, { authenticated: false, mustChangePassword: false });
    } else if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      client.setQueryData<AuthStatus>(queryKeys.auth, { authenticated: true, mustChangePassword: true });
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleAuthError }),
    mutationCache: new MutationCache({ onError: handleAuthError }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false,
      },
      mutations: { retry: false },
    },
  });
  return client;
}
