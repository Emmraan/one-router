import { CoreError } from './errors';
import { generateGeminiText } from './providers/gemini';
import type { FetchLike } from './types';

export const ENHANCE_SUFFIX =
  '\n\n[Please clarify, provide step-by-step reasoning, and format with markdown formatting.]';

export interface EnhancePromptOptions {
  prompt: string;
  apiKey?: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
}

export async function enhancePrompt(
  options: EnhancePromptOptions,
): Promise<string> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new CoreError('INVALID_REQUEST', 'Prompt is required');
  }

  if (!options.apiKey) {
    return `${prompt}${ENHANCE_SUFFIX}`;
  }

  try {
    const text = await generateGeminiText({
      apiKey: options.apiKey,
      fetch: options.fetch,
      signal: options.signal,
      prompt: `You are an expert prompt engineer. Enhance the following user prompt to make it clear, detailed, structured, and optimized to produce the highest quality response from an AI assistant. Retain all original intent and key constraints. Keep it relatively concise but highly optimized. Output only the final rewritten prompt itself, with no intro or outro comments.

User Prompt: "${prompt}"`,
    });
    return text.trim() || prompt;
  } catch {
    return prompt;
  }
}
