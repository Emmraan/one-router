import { Hono } from 'hono';
import {
  chatCompletion,
  customHeadersSchema,
  messageSchema,
  providerTypeSchema,
  type FetchLike,
  type Message,
} from '@one-router/core';
import { z } from 'zod';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';
import type { createFileStore } from '../files/storage';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveProvider } from '../providers/resolve';
import type { AppEnv } from '../types';
import { extractPdfText } from '../files/pdf';
import { redactEventStream } from './redact-stream';

const bodySchema = z.object({
  providerId: z.string().min(1).max(200).optional(),
  providerType: providerTypeSchema.optional(),
  model: z.string().min(1).max(500),
  messages: z.array(messageSchema).min(1).max(200),
  baseUrl: z.string().max(2048).optional(),
  apiKey: z.string().max(8192).optional(),
  customHeaders: customHeadersSchema,
}).strict();

const maxAttachmentCount = 50;
const maxAttachmentBytes = 50 * 1024 * 1024;

async function hydrateAttachments(
  owner: string,
  messages: Message[],
  fileStore: ReturnType<typeof createFileStore>,
): Promise<Message[]> {
  const hydrated: Message[] = [];
  let count = 0;
  let total = 0;
  for (const message of messages) {
    if (!message.attachments?.length) {
      hydrated.push(message);
      continue;
    }
    if (message.attachments.length > 10) throw new HttpError(400, 'At most 10 files are allowed per message', 'TOO_MANY_FILES');
    const attachments: NonNullable<Message['attachments']> = [];
    let content = message.content;
    const seen = new Set<string>();
    for (const attachment of message.attachments) {
      if (seen.has(attachment.id)) throw new HttpError(400, 'Duplicate attachment', 'INVALID_REQUEST');
      seen.add(attachment.id);
      const result = await fileStore.read(owner, attachment.id);
      if (!result) throw new HttpError(400, 'Attachment is not available', 'ATTACHMENT_NOT_FOUND');
      count += 1;
      total += result.file.size;
      if (count > maxAttachmentCount || total > maxAttachmentBytes) {
        throw new HttpError(400, 'Attachments exceed the chat limit', 'TOTAL_TOO_LARGE');
      }
      if (result.file.mimeType.startsWith('text/') || result.file.mimeType === 'application/json' || result.file.mimeType === 'application/pdf') {
        const text = result.file.mimeType === 'application/pdf'
          ? await extractPdfText(result.bytes)
          : result.bytes.toString('utf8');
        if (content.length + text.length > 200000) throw new HttpError(400, 'Attachment text exceeds the context limit', 'TOTAL_TOO_LARGE');
        content += `\n\n[File: ${result.file.name}]\n${text}\n[End file]`;
      } else attachments.push({
        id: result.file.id,
        name: result.file.name,
        type: result.file.mimeType,
        size: result.file.size,
        url: `/api/files/${result.file.id}`,
        base64: result.bytes.toString('base64'),
      });
    }
    hydrated.push({ ...message, content, attachments });
  }
  return hydrated;
}

export function chatRoutes(deps: {
  env: ServerEnv;
  auth: ReturnType<typeof createAuth>;
  fileStore: ReturnType<typeof createFileStore>;
  fetch?: FetchLike;
}) {
  const app = new Hono<AppEnv>();

  app.post('/chat', async (c) => {
    const body = await readJson(c, bodySchema, 10 * 1024 * 1024);
    const resolved = await resolveProvider({
      repos: deps.auth.repos, env: deps.env, owner: c.get('ownerId'),
      input: {
        providerId: body.providerId, providerType: body.providerType, baseUrl: body.baseUrl,
        apiKey: body.apiKey, customHeaders: body.customHeaders,
      },
    });
    if (resolved.providerType !== 'ollama' && !resolved.apiKey && !resolved.baseUrl) {
      throw new HttpError(400, 'No API key is configured for this provider', 'PROVIDER_KEY_MISSING');
    }

    const messages = await hydrateAttachments(c.get('ownerId'), body.messages, deps.fileStore);
    const timeout = AbortSignal.timeout(120_000);
    const signal = AbortSignal.any([c.req.raw.signal, timeout]);
    const stream = await chatCompletion({
      providerType: resolved.providerType,
      model: body.model,
      messages,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      customHeaders: resolved.customHeaders,
    }, { fetch: deps.fetch, signal });

    return new Response(redactEventStream(stream), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });

  return app;
}
