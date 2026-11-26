import { Hono } from 'hono';
import { createAuth } from './middleware/auth';
import { bodyLimit } from './middleware/body';
import { cors } from './middleware/cors';
import { csrf } from './middleware/csrf';
import { handleError, notFound } from './middleware/error';
import { consoleLogger, requestLogger } from './middleware/logger';
import { createRateLimiter } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { securityHeaders } from './middleware/security-headers';
import { createFileStore } from './files/storage';
import { authRoutes } from './routes/auth';
import { chatRoutes as chatCompletionRoutes } from './routes/chat';
import { chatRoutes as chatDataRoutes } from './routes/chats';
import { dataRoutes } from './routes/data';
import { discoveryRoutes } from './routes/discovery';
import { enhanceRoutes } from './routes/enhance';
import { fileRoutes } from './routes/files';
import { healthRoutes } from './routes/health';
import { messageRoutes } from './routes/messages';
import { openApiRoutes } from './routes/openapi';
import { providerRoutes } from './routes/providers';
import { settingRoutes } from './routes/settings';
import { titleRoutes } from './routes/title';
import { v1Routes } from './routes/v1';
import type { AppEnv, AppOptions } from './types';

export function createApp(options: AppOptions) {
  const now = options.now ?? Date.now;
  const logger = options.logger ?? consoleLogger;
  const fileStore = options.fileStore ?? createFileStore({ db: options.db, env: options.env, fetch: options.fetch });
  const auth = createAuth({ db: options.db, env: options.env, now });
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, now });
  const passwordLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, now });

  const app = new Hono<AppEnv>();
  app.use('*', requestId());
  app.use('*', requestLogger(logger));
  app.use('*', securityHeaders(options.env.production));
  app.use('*', cors(options.env));
  app.use('*', bodyLimit(80 * 1024 * 1024));
  app.use('*', csrf(options.env));
  app.use('*', async (c, next) => {
    await next();
    if (c.req.path.startsWith('/api') || c.req.path.startsWith('/v1')) {
      c.header('Cache-Control', 'no-store');
    }
  });

  app.route('/', healthRoutes(options.db, options.env));
  app.route('/', openApiRoutes(options.env));
  app.route('/api/auth', authRoutes({
    env: options.env, now, auth, loginLimiter, passwordLimiter,
  }));

  const api = new Hono<AppEnv>();
  api.use('*', auth.requireAuth());
  api.route('/chats', chatDataRoutes({ db: options.db, auth, fileStore }));
  api.route('/', messageRoutes({ auth, fileStore }));
  api.route('/providers', providerRoutes({ auth }));
  api.route('/settings', settingRoutes({ auth }));
  api.route('/files', fileRoutes({ env: options.env, auth, fileStore }));
  api.route('/data', dataRoutes({ db: options.db, auth, fileStore, now }));
  api.route('/', chatCompletionRoutes({ env: options.env, auth, fileStore, fetch: options.fetch }));
  api.route('/title', titleRoutes({ env: options.env, auth, fetch: options.fetch }));
  api.route('/enhance', enhanceRoutes({ env: options.env, auth, fetch: options.fetch }));
  api.route('/discovery', discoveryRoutes({ env: options.env, auth, fetch: options.fetch }));
  app.route('/api', api);

  const v1 = new Hono<AppEnv>();
  v1.use('*', auth.requireAuth());
  v1.route('/', v1Routes({ env: options.env, auth, fetch: options.fetch, now }));
  app.route('/v1', v1);

  app.onError(handleError);
  app.notFound(notFound);
  return app;
}
