import { Hono } from 'hono';
import { z } from 'zod';
import { searchChats, type Database } from '@one-router/db';
import type { createFileStore } from '../files/storage';
import { HttpError } from '../errors';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { repositoryFailure } from './errors';

const createSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  title: z.string().max(500).optional(),
  model: z.string().min(1).max(500),
  providerId: z.string().min(1).max(200).nullable().optional(),
  isPinned: z.boolean().optional(),
}).strict();

const patchSchema = z.object({
  title: z.string().max(500).optional(),
  source: z.enum(['manual', 'automatic']).optional(),
  isPinned: z.boolean().optional(),
  model: z.string().min(1).max(500).optional(),
  providerId: z.string().min(1).max(200).nullable().optional(),
}).strict();

function queryLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new HttpError(400, 'Invalid pagination limit', 'INVALID_REQUEST');
  return parsed;
}

export function chatRoutes(deps: { db: Database; auth: ReturnType<typeof createAuth>; fileStore: ReturnType<typeof createFileStore> }) {
  const app = new Hono<AppEnv>();
  const repos = deps.auth.repos;

  app.get('/', async (c) => {
    const owner = c.get('ownerId');
    try {
      const options = {
        limit: queryLimit(c.req.query('limit')),
        cursor: c.req.query('cursor'),
        trash: c.req.query('trash') === 'true',
      };
      const query = c.req.query('q')?.trim();
      return c.json(query ? await searchChats(deps.db, owner, query, { ...options, signal: c.req.raw.signal }) : await repos.chats.list(owner, options));
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.post('/save', async (c) => {
    const message = z.object({
      role: z.enum(['user', 'assistant', 'system']), content: z.string().max(100000),
      model: z.string().min(1).max(500).optional(), createdAt: z.number().int().nonnegative().optional(),
      isRegenerated: z.boolean().optional(), attachmentIds: z.array(z.string().min(1).max(200)).max(10).optional(),
    }).strict();
    const body = await readJson(c, createSchema.extend({ messages: z.array(message).min(1).max(200) }), 4 * 1024 * 1024);
    try {
      const { messages, ...chat } = body;
      return c.json({ chat: await repos.saveConversation(c.get('ownerId'), { ...chat, title: chat.title ?? 'New Chat' }, messages) }, 201);
    } catch (error) { return repositoryFailure(error); }
  });

  app.post('/', async (c) => {
    const body = await readJson(c, createSchema, 64 * 1024);
    try {
      const chat = await repos.chats.create(c.get('ownerId'), {
        ...body,
        title: body.title ?? 'New Chat',
      });
      return c.json({ chat }, 201);
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.get('/:id', async (c) => {
    const chat = await repos.chats.get(c.get('ownerId'), c.req.param('id'));
    if (!chat) throw new HttpError(404, 'Chat not found', 'NOT_FOUND');
    return c.json({ chat });
  });

  app.patch('/:id', async (c) => {
    const owner = c.get('ownerId');
    const id = c.req.param('id');
    const body = await readJson(c, patchSchema, 64 * 1024);
    if (Object.keys(body).length === 0) throw new HttpError(400, 'No changes supplied', 'INVALID_REQUEST');
    const existing = await repos.chats.get(owner, id);
    if (!existing) throw new HttpError(404, 'Chat not found', 'NOT_FOUND');
    try {
      if (body.title !== undefined) await repos.chats.rename(owner, id, body.title, body.source ?? 'manual');
      if (body.isPinned !== undefined) await repos.chats.setPinned(owner, id, body.isPinned);
      if (body.model !== undefined || body.providerId !== undefined) {
        await repos.chats.setModel(owner, id, body.model ?? existing.model, body.providerId === undefined ? existing.providerId : body.providerId);
      }
      return c.json({ chat: await repos.chats.get(owner, id) });
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.delete('/:id', async (c) => {
    const owner = c.get('ownerId');
    const id = c.req.param('id');
    const chat = await repos.chats.get(owner, id);
    if (!chat) throw new HttpError(404, 'Chat not found', 'NOT_FOUND');
    if (c.req.query('permanent') === 'true') {
      await deps.fileStore.deleteObjects(owner, await repos.attachments.listForChat(owner, id));
      await repos.chats.permanentlyDelete(owner, id);
    } else {
      await repos.chats.softDelete(owner, id);
    }
    return c.json({ ok: true });
  });

  app.post('/:id/restore', async (c) => {
    const owner = c.get('ownerId');
    const id = c.req.param('id');
    if (!(await repos.chats.get(owner, id))) throw new HttpError(404, 'Chat not found', 'NOT_FOUND');
    await repos.chats.restore(owner, id);
    return c.json({ ok: true });
  });

  return app;
}
