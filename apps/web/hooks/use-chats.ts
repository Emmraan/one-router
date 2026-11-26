'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createChat,
  deleteChat,
  listChats,
  updateChat,
  type CreateChatInput,
  type UpdateChatInput,
} from '../lib/api';
import { queryKeys } from '../lib/query';
import type { ChatDto } from '../lib/api-types';

function byUpdatedAt(chats: ChatDto[]): ChatDto[] {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useChats() {
  return useQuery({
    queryKey: queryKeys.chats,
    queryFn: () => listChats().then((page) => page.items),
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChatInput) => createChat(input),
    onSuccess: ({ chat }) => {
      queryClient.setQueryData<ChatDto[]>(queryKeys.chats, (old) =>
        byUpdatedAt([chat, ...(old ?? []).filter((c) => c.id !== chat.id)]),
      );
    },
  });
}

function patchToDto(patch: UpdateChatInput): Partial<ChatDto> {
  const next: Partial<ChatDto> = {};
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.isPinned !== undefined) next.isPinned = patch.isPinned;
  if (patch.model !== undefined) next.model = patch.model;
  if (patch.providerId !== undefined) next.providerId = patch.providerId;
  if (patch.source !== undefined) next.manualTitle = patch.source === 'manual';
  return next;
}

export function useUpdateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateChatInput }) => updateChat(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chats });
      const previous = queryClient.getQueryData<ChatDto[]>(queryKeys.chats);
      const dto = patchToDto(patch);
      queryClient.setQueryData<ChatDto[]>(queryKeys.chats, (old) =>
        (old ?? []).map((chat) => (chat.id === id ? { ...chat, ...dto, updatedAt: Date.now() } : chat)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.chats, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChat(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chats });
      const previous = queryClient.getQueryData<ChatDto[]>(queryKeys.chats);
      queryClient.setQueryData<ChatDto[]>(queryKeys.chats, (old) => (old ?? []).filter((chat) => chat.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.chats, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
    },
  });
}
