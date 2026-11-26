import { handle } from 'hono/vercel';
import { createApp } from './app';
import { bootstrapDatabase } from './bootstrap';
import { loadEnv } from './env';

const env = loadEnv();
const { db } = await bootstrapDatabase(env);
const app = createApp({ db, env });

export default handle(app);
