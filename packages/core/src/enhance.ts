import { CoreError } from './errors';
import { generateGeminiText } from './providers/gemini';
import type { FetchLike } from './types';

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
    throw new CoreError(
      'PROVIDER_REQUIRED',
      'Select a provider and model before enhancing',
    );
  }

  const text = await generateGeminiText({
    apiKey: options.apiKey,
    fetch: options.fetch,
    signal: options.signal,
    prompt: `You are an expert prompt engineer. Enhance the following user prompt to make it clear, detailed, structured, and optimized to produce the highest quality response from an AI assistant. Retain all original intent and key constraints. Keep it relatively concise but highly optimized. Output only the final rewritten prompt itself, with no intro or outro comments.

User Prompt: "${prompt}"`,
  });
  const enhanced = text.trim();
  if (!enhanced) {
    throw new CoreError('UPSTREAM_ERROR', 'The provider returned no prompt');
  }
  return enhanced;
}
