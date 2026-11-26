import { Hono } from 'hono';
import { z } from 'zod';
import type { createFileStore } from '../files/storage';
import { HttpError } from '../errors';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { repositoryFailure } from './errors';

const appendSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(100000),
  model: z.string().min(1).max(500).optional(),
  attachmentIds: z.array(z.string().min(1).max(200)).max(10).optional(),
  createdAt: z.number().int().nonnegative().optional(),
  isRegenerated: z.boolean().optional(),
}).strict();

const updateSchema = z.object({ content: z.string().max(100000) }).strict();

function limit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new HttpError(400, 'Invalid pagination limit', 'INVALID_REQUEST');
  return parsed;
}

export function messageRoutes(deps: { auth: ReturnType<typeof createAuth>; fileStore: ReturnType<typeof createFileStore> }) {
  const app = new Hono<AppEnv>();
  const repos = deps.auth.repos;

  app.get('/chats/:chatId/messages', async (c) => {
    const owner = c.get('ownerId');
    const chatId = c.req.param('chatId');
    if (!(await repos.chats.get(owner, chatId))) throw new HttpError(404, 'Chat not found', 'NOT_FOUND');
    try {
      return c.json(await repos.messages.list(owner, chatId, {
        limit: limit(c.req.query('limit')),
        cursor: c.req.query('cursor'),
      }));
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.post('/chats/:chatId/messages', async (c) => {
    const body = await readJson(c, appendSchema, 512 * 1024);
    try {
      const message = await repos.messages.append(c.get('ownerId'), c.req.param('chatId'), body);
      return c.json({ message }, 201);
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.patch('/messages/:id', async (c) => {
    const body = await readJson(c, updateSchema, 512 * 1024);
    try {
      const message = await repos.messages.update(c.get('ownerId'), c.req.param('id'), body.content);
      if (!message) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
      return c.json({ message });
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.delete('/messages/:id', async (c) => {
    const owner = c.get('ownerId');
    const id = c.req.param('id');
    if (!(await repos.messages.get(owner, id))) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    await deps.fileStore.deleteObjects(owner, await repos.attachments.listForMessage(owner, id));
    await repos.messages.delete(owner, id);
    return c.json({ ok: true });
  });

  return app;
}
