'use client';

import { useQuery } from '@tanstack/react-query';
import { listAllMessages } from '../lib/api';
import { queryKeys } from '../lib/query';
import type { MessageDto } from '../lib/api-types';

export function useMessages(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.messages(chatId ?? 'none'),
    queryFn: () => listAllMessages(chatId as string),
    enabled: Boolean(chatId) && enabled && !chatId?.startsWith('temporary-'),
  });
}

export type MessagesCache = MessageDto[];
