import { z } from 'zod';
import { providerTypeSchema } from '@one-router/core';
import { normalizeBaseUrl } from '@one-router/core';

export const idSchema = z.string().min(1).max(200).refine((value) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value), 'Invalid identifier');
export const timeSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const titleSchema = z.string().max(500);
export const modelSchema = z.string().min(1).max(500);
export const providerInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(200),
  type: providerTypeSchema,
  baseUrl: z.string().min(1).max(2048).transform((value) => normalizeBaseUrl(value)),
  apiKey: z.string().max(8192).optional(),
  customHeaders: z.union([
    z.string().max(16384), z.record(z.string().max(200), z.string().max(8192)),
  ]).optional(),
  models: z.array(modelSchema).max(1000).default([]),
  isActive: z.boolean().default(true),
}).strict();
export const chatInputSchema = z.object({
  id: idSchema.optional(), title: titleSchema, model: modelSchema,
  providerId: idSchema.nullable().optional(), isPinned: z.boolean().optional(),
  now: timeSchema.optional(), isTemporary: z.boolean().optional(),
}).strict();
export const messageInputSchema = z.object({
  id: idSchema.optional(), role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(100000), model: modelSchema.optional(),
  attachmentIds: z.array(idSchema).max(10).optional(), createdAt: timeSchema.optional(),
  isRegenerated: z.boolean().optional(),
}).strict();

export const archiveProviderSchema = providerInputSchema.extend({ id: idSchema, createdAt: timeSchema, updatedAt: timeSchema });

export function validateJson(value: unknown, maxBytes = 65536): string {
  const text = JSON.stringify(value);
  if (text === undefined || Buffer.byteLength(text) > maxBytes) throw new Error('Invalid JSON value or size');
  return text;
}

export function settingKey(key: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9._-]{0,99}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
    throw new Error('Invalid setting key');
  }
  return key;
}
