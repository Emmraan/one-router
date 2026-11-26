import { Hono } from 'hono';
import type { ServerEnv } from '../env';
import type { AppEnv } from '../types';

export function openApiRoutes(env: ServerEnv) {
  const app = new Hono<AppEnv>();
  app.get('/openapi.json', (c) => c.json({
    openapi: '3.1.0',
    info: { title: 'ONE ROUTER API', version: env.version },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'one_router_session' },
        bearerToken: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        ChatMessage: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { enum: ['system', 'user', 'assistant'] },
            content: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'object' } }] },
          },
        },
        ChatRequest: {
          type: 'object',
          required: ['model', 'messages'],
          properties: {
            model: { type: 'string', description: 'provider/model or a configured alias' },
            messages: { type: 'array', items: { $ref: '#/components/schemas/ChatMessage' } },
            stream: { type: 'boolean' },
          },
        },
      },
    },
    security: [{ sessionCookie: [] }, { bearerToken: [] }],
    paths: {
      '/health': {
        get: {
          security: [],
          summary: 'Health and database connectivity',
          responses: { '200': { description: 'Healthy' }, '503': { description: 'Database unavailable' } },
        },
      },
      '/v1/models': {
        get: {
          summary: 'List routable models and aliases',
          responses: { '200': { description: 'OpenAI-compatible model list' }, '401': { description: 'Authentication required' } },
        },
      },
      '/v1/chat/completions': {
        post: {
          summary: 'OpenAI-compatible chat completion',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } },
          },
          responses: {
            '200': { description: 'Completion or SSE stream' },
            '400': { description: 'Invalid model or request' },
            '401': { description: 'Authentication required' },
          },
        },
      },
    },
  }));
  return app;
}
