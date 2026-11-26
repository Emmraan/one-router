import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { chatCompletion, type FetchLike } from '@one-router/core';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ServerEnv } from '../env';
import { HttpError, mapError } from '../errors';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveProvider } from '../providers/resolve';
import type { AppEnv } from '../types';
import { loadAliases, resolveV1Model } from '../v1/models';
import { requestSchema, toCoreMessages } from '../v1/messages';
import { collectStream, openAiStream } from '../v1/stream';

function v1Error(c: { json: (body: unknown, status: ContentfulStatusCode) => Response }, error: unknown): Response {
  const mapped = mapError(error);
  return c.json({
    error: { message: mapped.message, type: 'one_router_error', code: mapped.code },
  }, mapped.status as ContentfulStatusCode);
}

export function v1Routes(deps: {
  env: ServerEnv;
  auth: ReturnType<typeof createAuth>;
  fetch?: FetchLike;
  now: () => number;
}) {
  const app = new Hono<AppEnv>();
  const repos = deps.auth.repos;

  app.get('/models', async (c) => {
    const owner = c.get('ownerId');
    const providers = await repos.providers.list(owner);
    const data: Array<{ id: string; object: 'model'; created: number; owned_by: string }> = [];
    for (const provider of providers) {
      for (const model of provider.models) {
        data.push({ id: `${provider.id}/${model}`, object: 'model', created: 0, owned_by: provider.type });
      }
    }
    for (const alias of await loadAliases(repos, owner)) {
      data.push({ id: alias.alias, object: 'model', created: 0, owned_by: 'alias' });
    }
    const unique = [...new Map(data.map((item) => [item.id, item])).values()];
    return c.json({ object: 'list', data: unique });
  });

  app.post('/chat/completions', async (c) => {
    try {
      const body = await readJson(c, requestSchema, 20 * 1024 * 1024);
      const resolved = await resolveV1Model({ repos, owner: c.get('ownerId'), model: body.model });
      const provider = await resolveProvider({
        repos, env: deps.env, owner: c.get('ownerId'),
        input: { providerId: resolved.providerId, providerType: resolved.providerType },
      });
      if (resolved.providerType !== 'ollama' && !provider.apiKey && !provider.baseUrl) {
        throw new HttpError(400, 'No API key is configured for this provider', 'PROVIDER_KEY_MISSING');
      }
      const stream = await chatCompletion({
        providerType: resolved.providerType,
        model: resolved.model,
        messages: toCoreMessages(body.messages, deps.now()),
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        customHeaders: provider.customHeaders,
      }, { fetch: deps.fetch, signal: AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(120_000)]) });

      const id = `chatcmpl-${randomUUID()}`;
      const created = Math.floor(deps.now() / 1000);
      if (body.stream) {
        return new Response(openAiStream(stream, { id, model: body.model, created }), {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }
      const content = await collectStream(stream);
      return c.json({
        id,
        object: 'chat.completion',
        created,
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    } catch (error) {
      return v1Error(c, error);
    }
  });

  return app;
}
