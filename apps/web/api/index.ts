import { getRequestListener } from '@hono/node-server';
import { vercelFetch } from '@one-router/server/vercel';

export default getRequestListener(vercelFetch);
