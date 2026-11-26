import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/tables.ts',
  out: './src/migrations',
  dialect: 'sqlite',
});
