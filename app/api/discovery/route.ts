import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey, providerType } = await req.json();

    if (!providerType) {
      return NextResponse.json({ error: 'Provider type is required' }, { status: 400 });
    }

    let resolvedApiKey = apiKey || '';
    if (providerType === 'gemini' && !resolvedApiKey) {
      resolvedApiKey = process.env.GEMINI_API_KEY || '';
    }

    let fetchedModels: string[] = [];

    if (providerType === 'openai') {
      const targetUrl = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/models`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (resolvedApiKey) {
        headers['Authorization'] = `Bearer ${resolvedApiKey}`;
      }

      const res = await fetch(targetUrl, { method: 'GET', headers });
      if (res.ok) {
        const body = await res.json();
        if (body.data && Array.isArray(body.data)) {
          fetchedModels = body.data.map((item: any) => item.id);
        }
      }
    } else if (providerType === 'ollama') {
      const targetUrl = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/tags`;
      const res = await fetch(targetUrl, { method: 'GET' });
      if (res.ok) {
        const body = await res.json();
        if (body.models && Array.isArray(body.models)) {
          fetchedModels = body.models.map((item: any) => item.name);
        }
      } else {
        // Fallback: try standard /v1/models (some custom API proxy setups)
        const altUrl = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/v1/models`;
        const altRes = await fetch(altUrl, { method: 'GET' });
        if (altRes.ok) {
          const altBody = await altRes.json();
          if (altBody.data && Array.isArray(altBody.data)) {
            fetchedModels = altBody.data.map((item: any) => item.id);
          }
        }
      }
    } else if (providerType === 'gemini') {
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${resolvedApiKey}`;
      const res = await fetch(targetUrl, { method: 'GET' });
      if (res.ok) {
        const body = await res.json();
        if (body.models && Array.isArray(body.models)) {
          fetchedModels = body.models
            .map((item: any) => item.name.replace('models/', ''))
            .filter((name: string) => !name.startsWith('embedding-') && !name.includes('bidi') && !name.includes('classifier'));
        }
      }
    } else if (providerType === 'anthropic') {
      const targetUrl = `${(baseUrl || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/models`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      if (resolvedApiKey) {
        headers['x-api-key'] = resolvedApiKey;
      }
      
      const res = await fetch(targetUrl, { method: 'GET', headers });
      if (res.ok) {
        const body = await res.json();
        // Anthropic models API returns a list of models with id
        if (body.data && Array.isArray(body.data)) {
          fetchedModels = body.data.map((item: any) => item.id);
        } else if (Array.isArray(body)) {
          fetchedModels = body.map((item: any) => item.id || item);
        }
      }
    }

    if (fetchedModels.length === 0) {
      // Return representative default arrays if discovery fails
      return NextResponse.json({
        success: false,
        error: 'No models found dynamically. Proceeded with preset defaults.',
      });
    }

    // Sort models alphabetically for premium feel
    fetchedModels.sort();

    return NextResponse.json({
      success: true,
      models: fetchedModels,
    });
  } catch (err: any) {
    console.error('Discovery Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Discovery connection error',
    });
  }
}
