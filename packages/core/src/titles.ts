import type { FetchLike } from './types';
import { generateGeminiText } from './providers/gemini';

export interface GenerateTitleOptions {
  message: string;
  apiKey?: string;
  fetch?: FetchLike;
}

export function deriveTitle(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'New Chat';

  const words = normalized.split(' ');
  if (words.length <= 5) return normalized;
  return `${words.slice(0, 5).join(' ')}...`;
}

export function normalizeTitle(raw: string): string {
  let title = raw.replace(/\s+/g, ' ').trim();
  title = title.replace(/^["'`]+|["'`]+$/g, '').trim();
  title = title.replace(/^(?:title|chat title)\s*:\s*/i, '').trim();

  if (!title) return 'New Chat';
  if (title.length > 80) {
    title = `${title.slice(0, 77).trimEnd()}...`;
  }
  return title;
}

export async function generateTitle(
  options: GenerateTitleOptions,
): Promise<string> {
  const message = options.message.trim();
  if (!message) return 'New Chat';

  const fallback = deriveTitle(message);
  if (!options.apiKey) return fallback;

  try {
    const text = await generateGeminiText({
      apiKey: options.apiKey,
      fetch: options.fetch,
      prompt: `Generate a short chat title of 3 to 6 words in the same language as the user message. Use only the title text, with no quotation marks, prefix, greeting, or punctuation.

User Message: "${message}"`,
    });
    const title = normalizeTitle(text);
    return title === 'New Chat' ? fallback : title;
  } catch {
    return fallback;
  }
}
