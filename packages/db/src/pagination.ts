import { z } from 'zod';
import { idSchema, timeSchema } from './repositories/validation';

const cursorSchema = z.object({
  scope: z.string().max(1000), id: idSchema,
  time: timeSchema, pinned: z.boolean(), position: timeSchema,
}).strict();
export type Cursor = z.infer<typeof cursorSchema>;

export function pageLimit(limit = 50): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid pagination limit (1 to 100)');
  return limit;
}

export function encodePage(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodePage(value: string | undefined, scope: string): Cursor | null {
  if (value === undefined) return null;
  try {
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(value)) throw new Error();
    const decoded = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    if (decoded.scope !== scope) throw new Error();
    return decoded;
  } catch {
    throw new Error('Invalid pagination cursor');
  }
}
