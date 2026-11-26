import type { Store } from '../client';
import { decryptText, encryptText } from '../crypto/encryption';

export function fieldContext(owner: string, table: string, id: string, field: string): string {
  return JSON.stringify([owner, table, id, field]);
}

export function seal(store: Store, owner: string, table: string, id: string, field: string, text: string): string {
  return encryptText(text, store.key, fieldContext(owner, table, id, field));
}

export function unseal(store: Store, owner: string, table: string, id: string, field: string, text: string): string {
  return decryptText(text, store.key, fieldContext(owner, table, id, field));
}
