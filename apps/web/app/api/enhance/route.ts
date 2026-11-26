import { NextRequest, NextResponse } from 'next/server';
import { enhancePrompt, isCoreError } from '@one-router/core';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prompt?: unknown };
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const apiKey = process.env.GEMINI_API_KEY || '';

    const enhanced = await enhancePrompt({ prompt, apiKey });
    return NextResponse.json({ enhanced });
  } catch (error) {
    if (isCoreError(error) && error.code === 'INVALID_REQUEST') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Enhancement failed' }, { status: 500 });
  }
}
