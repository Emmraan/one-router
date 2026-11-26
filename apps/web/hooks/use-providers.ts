'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProvider,
  deleteProvider,
  listProviders,
  updateProvider,
  type ProviderInput,
  type ProviderPatch,
} from '../lib/api';
import { queryKeys } from '../lib/query';

export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => listProviders().then((data) => data.providers),
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderInput) => createProvider(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers });
    },
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProviderPatch }) => updateProvider(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers });
    },
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers });
    },
  });
}
