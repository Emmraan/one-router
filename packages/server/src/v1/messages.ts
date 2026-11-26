import type { Message } from '@one-router/core';
import { z } from 'zod';
import { HttpError } from '../errors';

const textPart = z.object({ type: z.literal('text'), text: z.string() });
const imagePart = z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string().max(15 * 1024 * 1024) }) });
const partSchema = z.union([textPart, imagePart]);
export const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([z.string().max(200000), z.array(partSchema).max(20)]),
});
export const requestSchema = z.object({
  model: z.string().min(1).max(500),
  messages: z.array(messageSchema).min(1).max(200),
  stream: z.boolean().optional(),
});

const dataImage = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function imageAttachment(url: string): { type: string; base64: string; size: number } {
  const match = dataImage.exec(url);
  if (!match) throw new HttpError(400, 'Only base64 image data URLs are supported', 'UNSUPPORTED_CONTENT');
  if (match[2].length > 14 * 1024 * 1024) throw new HttpError(413, 'Image is too large', 'PAYLOAD_TOO_LARGE');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.byteLength > 10 * 1024 * 1024) throw new HttpError(413, 'Image is too large', 'PAYLOAD_TOO_LARGE');
  if (bytes.toString('base64') !== match[2]) throw new HttpError(400, 'Invalid base64 image', 'INVALID_REQUEST');
  return { type: match[1], base64: match[2], size: bytes.byteLength };
}

export function toCoreMessages(messages: z.infer<typeof requestSchema>['messages'], now: number): Message[] {
  return messages.map((message, index) => {
    const id = `v1-${index}`;
    if (typeof message.content === 'string') {
      return { id, role: message.role, content: message.content, timestamp: now };
    }
    const text: string[] = [];
    const attachments: NonNullable<Message['attachments']> = [];
    message.content.forEach((part, partIndex) => {
      if (part.type === 'text') {
        text.push(part.text);
        return;
      }
      const image = imageAttachment(part.image_url.url);
      attachments.push({
        id: `${id}-${partIndex}`,
        name: `image-${partIndex}`,
        type: image.type,
        size: image.size,
        url: '',
        base64: image.base64,
      });
    });
    return {
      id,
      role: message.role,
      content: text.join('\n'),
      timestamp: now,
      ...(attachments.length > 0 ? { attachments } : {}),
    };
  });
}
