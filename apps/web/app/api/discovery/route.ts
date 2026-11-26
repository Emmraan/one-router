import { NextRequest, NextResponse } from 'next/server';
import {
  discoverModels,
  isCoreError,
  type DiscoveryRequest,
} from '@one-router/core';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DiscoveryRequest;
    if (!body?.providerType) {
      return NextResponse.json(
        { error: 'Provider type is required' },
        { status: 400 },
      );
    }

    const apiKey =
      body.apiKey ||
      (body.providerType === 'gemini' ? process.env.GEMINI_API_KEY || '' : '');

    const result = await discoverModels({ ...body, apiKey });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: isCoreError(error) ? error.message : 'Discovery connection error',
    });
  }
}
