import type { Store } from '../client';
import { atomic } from '../client';
import type { z } from 'zod';
import { chatInputSchema, messageInputSchema } from './validation';
import { attachmentRepository } from './attachments';
import { chatRepository } from './chats';
import { configurationRepositories } from './configuration';
import { identityRepositories } from './identity';
import { messageRepository } from './messages';

export function createRepositories(store: Store) {
  return {
    async saveConversation(owner: string, chat: z.input<typeof chatInputSchema>, messages: z.input<typeof messageInputSchema>[]) {
      return atomic(store, async (tx) => {
        const repos = createRepositories(tx);
        const saved = await repos.chats.create(owner, chat);
        for (const message of messages) await repos.messages.append(owner, saved.id, message);
        return (await repos.chats.get(owner, saved.id))!;
      });
    },
    ...identityRepositories(store), ...configurationRepositories(store),
    chats: chatRepository(store), messages: messageRepository(store), attachments: attachmentRepository(store),
  };
}
