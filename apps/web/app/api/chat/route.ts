import { NextRequest } from 'next/server';
import {
  chatCompletion,
  isCoreError,
  type ChatRequest,
} from '@one-router/core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;
    if (!body?.providerType) {
      return new Response(JSON.stringify({ error: 'Provider type is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey =
      body.apiKey ||
      (body.providerType === 'gemini' ? process.env.GEMINI_API_KEY || '' : '');

    const stream = await chatCompletion({ ...body, apiKey });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const status = isCoreError(error) ? error.status : 500;
    const message = isCoreError(error) ? error.message : 'Server error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
