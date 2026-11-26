import { z } from 'zod';
import { PROVIDER_TYPES } from './types';

export const providerTypeSchema = z.enum(PROVIDER_TYPES);

export const attachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
  url: z.string(),
  base64: z.string().optional(),
});

export const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number(),
  attachments: z.array(attachmentSchema).optional(),
  model: z.string().optional(),
  isRegenerated: z.boolean().optional(),
});

export const customHeadersSchema = z
  .union([z.record(z.string(), z.string()), z.string()])
  .optional();

export const chatRequestSchema = z.object({
  providerType: providerTypeSchema,
  model: z.string().min(1),
  messages: z.array(messageSchema).min(1),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  customHeaders: customHeadersSchema,
});

export const discoveryRequestSchema = z.object({
  providerType: providerTypeSchema,
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

export const titleRequestSchema = z.object({
  message: z.string(),
});

export const enhanceRequestSchema = z.object({
  prompt: z.string().min(1),
});

export const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: providerTypeSchema,
  baseUrl: z.string().min(1),
  apiKey: z.string().optional(),
  models: z.array(z.string().min(1)),
  customHeaders: customHeadersSchema,
  isActive: z.boolean(),
});
