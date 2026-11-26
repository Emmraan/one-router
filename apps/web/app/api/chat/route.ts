import { NextRequest } from 'next/server';

export const runtime = 'nodejs'; // Node runtime for streaming proxy

function parseCustomHeaders(headerStr?: string): Record<string, string> {
  if (!headerStr) return {};
  try {
    return JSON.parse(headerStr);
  } catch (e) {
    // If not valid JSON, treat it as newline-separated Key: Value pairs
    const headers: Record<string, string> = {};
    const lines = headerStr.split('\n');
    for (const line of lines) {
      const index = line.indexOf(':');
      if (index > -1) {
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    }
    return headers;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      baseUrl,
      apiKey,
      providerType,
      model,
      messages,
      customHeaders,
    } = body;

    if (!providerType) {
      return new Response(JSON.stringify({ error: 'Provider type is required' }), { status: 400 });
    }

    // Determine target URL and Headers
    let targetUrl = '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const parsedUserHeaders = parseCustomHeaders(customHeaders);
    Object.assign(headers, parsedUserHeaders);

    let resolvedApiKey = apiKey || '';

    // Handle ambient Gemini key fallback if direct Gemini is requested and no key provided
    if (providerType === 'gemini' && !resolvedApiKey) {
      resolvedApiKey = process.env.GEMINI_API_KEY || '';
    }

    let requestBody: any = {};

    if (providerType === 'openai' || providerType === 'ollama') {
      const effectiveBaseUrl = baseUrl || (providerType === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434');
      // Strip trailing slash if present
      const cleanBaseUrl = effectiveBaseUrl.replace(/\/$/, '');
      targetUrl = `${cleanBaseUrl}/chat/completions`;

      if (resolvedApiKey) {
        headers['Authorization'] = `Bearer ${resolvedApiKey}`;
      }

      // Standard OpenAI format chat payload
      const mappedMessages = messages.map((m: any) => {
        // If attachments are present
        if (m.attachments && m.attachments.length > 0) {
          const contentParts: any[] = [];
          
          // Add text first
          if (m.content) {
            contentParts.push({ type: 'text', text: m.content });
          }

          for (const att of m.attachments) {
            if (att.type.startsWith('image/')) {
              // Standard image url format
              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: att.base64 ? `data:${att.type};base64,${att.base64}` : att.url,
                }
              });
            } else {
              // For non-images, prepend description
              contentParts.push({
                type: 'text',
                text: `\n[Attached File: ${att.name} (${Math.round(att.size / 1024)} KB)]`
              });
            }
          }

          return { role: m.role, content: contentParts };
        }

        return { role: m.role, content: m.content };
      });

      requestBody = {
        model,
        messages: mappedMessages,
        stream: true,
      };

    } else if (providerType === 'anthropic') {
      const effectiveBaseUrl = baseUrl || 'https://api.anthropic.com/v1';
      const cleanBaseUrl = effectiveBaseUrl.replace(/\/$/, '');
      targetUrl = `${cleanBaseUrl}/messages`;

      if (resolvedApiKey) {
        headers['x-api-key'] = resolvedApiKey;
      }
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';

      // Format Claude messages
      const systemMessages = messages.filter((m: any) => m.role === 'system');
      const chatMessages = messages.filter((m: any) => m.role !== 'system');

      const systemPrompt = systemMessages.map((m: any) => m.content).join('\n');

      const mappedMessages = chatMessages.map((m: any) => {
        if (m.attachments && m.attachments.length > 0) {
          const contentParts: any[] = [];
          if (m.content) {
            contentParts.push({ type: 'text', text: m.content });
          }

          for (const att of m.attachments) {
            if (att.type.startsWith('image/')) {
              // Extract pure base64 (remove headers if any)
              let base64Data = att.base64 || '';
              if (base64Data.includes(';base64,')) {
                base64Data = base64Data.split(';base64,')[1];
              }
              contentParts.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: att.type,
                  data: base64Data,
                }
              });
            } else {
              contentParts.push({
                type: 'text',
                text: `\n[Attached File: ${att.name} (${Math.round(att.size / 1024)} KB)]`
              });
            }
          }
          return { role: m.role, content: contentParts };
        }
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      });

      requestBody = {
        model,
        messages: mappedMessages,
        max_tokens: 4096,
        stream: true,
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

    } else if (providerType === 'gemini') {
      // Calls Google Gemini REST streaming API directly
      const cleanModel = model || 'gemini-2.5-flash';
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${resolvedApiKey}`;

      const mappedContents = messages.map((m: any) => {
        const parts: any[] = [];
        
        if (m.content) {
          parts.push({ text: m.content });
        }

        if (m.attachments && m.attachments.length > 0) {
          for (const att of m.attachments) {
            if (att.type.startsWith('image/')) {
              let base64Data = att.base64 || '';
              if (base64Data.includes(';base64,')) {
                base64Data = base64Data.split(';base64,')[1];
              }
              parts.push({
                inlineData: {
                  mimeType: att.type,
                  data: base64Data,
                }
              });
            } else {
              parts.push({
                text: `\n[Attached File: ${att.name} (${Math.round(att.size / 1024)} KB)]`
              });
            }
          }
        }

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      // Gemini allows setting systemInstruction
      const systemMsg = messages.find((m: any) => m.role === 'system');
      const config: any = {};
      if (systemMsg) {
        config.systemInstruction = {
          parts: [{ text: systemMsg.content }]
        };
      }

      requestBody = {
        contents: mappedContents,
        config: config,
      };

    } else {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${providerType}` }), { status: 400 });
    }

    // Call upstream API
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      console.error(`Upstream error (${upstreamRes.status}):`, errorText);
      return new Response(
        JSON.stringify({ error: `Upstream error: ${errorText || upstreamRes.statusText}` }),
        { status: upstreamRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!upstreamRes.body) {
      return new Response(JSON.stringify({ error: 'No response body from upstream API' }), { status: 500 });
    }

    // Process stream line-by-line and normalize as SSE text data
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const upstreamReader = upstreamRes.body.getReader();

    const clientStream = new ReadableStream({
      async start(controller) {
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) {
              // Flush remaining buffer
              if (buffer) {
                parseAndControllerWrite(buffer, providerType, controller, encoder);
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process full lines in buffer
            let lineIndex: number;
            while ((lineIndex = buffer.indexOf('\n')) > -1) {
              const line = buffer.substring(0, lineIndex).trim();
              buffer = buffer.substring(lineIndex + 1);

              if (line) {
                parseAndControllerWrite(line, providerType, controller, encoder);
              }
            }
          }
        } catch (err: any) {
          console.error('Error during streaming reading:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err: any) {
    console.error('Proxy Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
}

function parseAndControllerWrite(
  line: string,
  providerType: 'openai' | 'anthropic' | 'gemini' | 'ollama',
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  // OpenAI and Ollama compatible SSE
  if (providerType === 'openai' || providerType === 'ollama') {
    if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      if (dataStr === '[DONE]') return;

      try {
        const parsed = JSON.parse(dataStr);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      } catch (e) {
        // Handle parsing issues
      }
    }
  }

  // Anthropic compatible SSE
  else if (providerType === 'anthropic') {
    if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
        }
      } catch (e) {
        // Handle gracefully
      }
    }
  }

  // Gemini direct model generate content SSE stream
  else if (providerType === 'gemini') {
    // Gemini stream chunks come as arrays or objects
    let normalized = line.trim();
    // Strip trailing commas from raw chunks array notation if present
    if (normalized.startsWith(',')) normalized = normalized.substring(1).trim();
    if (normalized.startsWith('[')) normalized = normalized.substring(1).trim();
    if (normalized.endsWith(']')) normalized = normalized.substring(0, normalized.length - 1).trim();

    if (!normalized) return;

    try {
      const parsed = JSON.parse(normalized);
      const parts = parsed.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        const text = parts.map((p: any) => p.text || '').join('');
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      }
    } catch (e) {
      // Chunk may be split or incomplete
    }
  }
}
