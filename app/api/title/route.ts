import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ title: 'New Chat' });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      const trimmed = message.trim();
      const firstWords = trimmed.split(/\s+/).slice(0, 5).join(' ');
      const title = firstWords + (trimmed.split(/\s+/).length > 5 ? '...' : '');
      return NextResponse.json({ title });
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a very brief, concise title (strictly between 2 to 5 words) for a chat conversation that begins with the following user message. Provide only the text of the title itself. No quotation marks, no leading/trailing prefix, no greeting, no punctuation.

User Message: "${message}"`
          }]
        }]
      })
    });

    if (!res.ok) {
      return NextResponse.json({ title: 'New Chat' });
    }

    const data = await res.json();
    const parsedTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Chat';
    const cleanTitle = parsedTitle.replace(/^["']|["']$/g, '').trim();

    return NextResponse.json({ title: cleanTitle });
  } catch (err: any) {
    console.error('Error generating title:', err);
    return NextResponse.json({ title: 'New Chat' });
  }
}
