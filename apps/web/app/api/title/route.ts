import { NextRequest, NextResponse } from 'next/server';
import { generateTitle } from '@one-router/core';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { message?: unknown };
    const message = typeof body?.message === 'string' ? body.message : '';
    const apiKey = process.env.GEMINI_API_KEY || '';

    const title = await generateTitle({ message, apiKey });
    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ title: 'New Chat' });
  }
}
