import type { Store } from '../client';
import { attachmentRepository } from './attachments';
import { chatRepository } from './chats';
import { configurationRepositories } from './configuration';
import { identityRepositories } from './identity';
import { messageRepository } from './messages';

export function createRepositories(store: Store) {
  return {
    ...identityRepositories(store), ...configurationRepositories(store),
    chats: chatRepository(store), messages: messageRepository(store), attachments: attachmentRepository(store),
  };
}
