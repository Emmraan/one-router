import { sql } from 'drizzle-orm';
import { blob, check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  role: text('role').notNull().default('owner'),
  passwordHash: text('password_hash').notNull(),
  profile: text('profile'),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: integer('locked_until'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [uniqueIndex('users_single_owner').on(t.role).where(sql`${t.role} = 'owner'`)]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (t) => [index('sessions_user').on(t.userId), index('sessions_expiry').on(t.expiresAt)]);

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['openai', 'anthropic', 'gemini', 'ollama'] }).notNull(),
  config: text('config').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [uniqueIndex('providers_owner_id').on(t.userId, t.id)]);

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id'),
  model: text('model').notNull(),
  title: text('title').notNull(),
  manualTitle: integer('manual_title', { mode: 'boolean' }).notNull().default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => [
  uniqueIndex('chats_owner_id').on(t.userId, t.id),
  index('chats_owner_page').on(t.userId, t.deletedAt, t.isPinned, t.updatedAt, t.id),
  index('chats_provider').on(t.userId, t.providerId),
  foreignKey({ columns: [t.userId, t.providerId], foreignColumns: [providers.userId, providers.id] }),
]);

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chatId: text('chat_id').notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'),
  position: integer('position').notNull(),
  isRegenerated: integer('is_regenerated', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  uniqueIndex('messages_owner_id').on(t.userId, t.id),
  uniqueIndex('messages_chat_position').on(t.chatId, t.position),
  check('messages_valid_role', sql`${t.role} IN ('user', 'assistant', 'system')`),
  check('messages_valid_position', sql`${t.position} >= 0`),
  foreignKey({ columns: [t.userId, t.chatId], foreignColumns: [chats.userId, chats.id] }).onDelete('cascade'),
]);

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageId: text('message_id'),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storage: text('storage', { enum: ['sqlite', 'filesystem', 's3'] }).notNull(),
  objectKey: text('object_key'),
  data: blob('data', { mode: 'buffer' }),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull(),
}, (t) => [
  index('attachments_message').on(t.userId, t.messageId),
  index('attachments_expiry').on(t.expiresAt),
  check('attachments_size', sql`${t.size} >= 0 AND ${t.size} <= 10485760`),
  check('attachments_storage', sql`(${t.storage} = 'sqlite' AND ${t.data} IS NOT NULL AND ${t.objectKey} IS NULL) OR (${t.storage} IN ('filesystem', 's3') AND ${t.data} IS NULL AND ${t.objectKey} IS NOT NULL)`),
  foreignKey({ columns: [t.userId, t.messageId], foreignColumns: [messages.userId, messages.id] }).onDelete('cascade'),
]);

export const settings = sqliteTable('settings', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.key] })]);
