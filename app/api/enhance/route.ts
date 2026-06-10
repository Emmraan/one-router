import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json({
        enhanced: `${prompt.trim()}\n\n[Please clarify, provide step-by-step reasoning, and format with markdown formatting.]`,
      });
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert prompt engineer. Enhance the following user prompt to make it clear, detailed, structured, and optimized to produce the highest quality response from an AI assistant. Retain all original intent and key constraints. Keep it relatively concise but highly optimized. Output only the final rewritten prompt itself, with no intro or outro comments.

User Prompt: "${prompt}"`
          }]
        }]
      })
    });

    if (!res.ok) {
      return NextResponse.json({ enhanced: prompt });
    }

    const data = await res.json();
    const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
    return NextResponse.json({ enhanced });
  } catch (err: any) {
    console.error('Enhancer Error:', err);
    return NextResponse.json({ enhanced: prompt });
  }
}
