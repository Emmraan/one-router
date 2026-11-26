'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePasswordRequest,
  fetchAuthStatus,
  loginRequest,
  logoutRequest,
  type ChangePasswordInput,
} from '../lib/api';
import { queryKeys } from '../lib/query';
import type { AuthStatus } from '../lib/api-types';

export function useAuthStatus() {
  return useQuery({ queryKey: queryKeys.auth, queryFn: fetchAuthStatus, staleTime: 0 });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => loginRequest(password),
    onSuccess: (status) => {
      queryClient.setQueryData<AuthStatus>(queryKeys.auth, status);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logoutRequest(),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData<AuthStatus>(queryKeys.auth, { authenticated: false, mustChangePassword: false });
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changePasswordRequest(input),
    onSuccess: (result) => {
      // Flip the cached flag before navigating so the app gate does not bounce
      // back to this page while the refetch is in flight.
      queryClient.setQueryData<AuthStatus>(queryKeys.auth, (previous) =>
        previous ? { ...previous, mustChangePassword: result.mustChangePassword } : previous,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth });
    },
  });
}
