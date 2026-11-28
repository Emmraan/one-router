// A local OpenAI-compatible provider for the browser suite. It lets the packed
// CLI run the same tests without a test-only route or a live provider.
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4100);
const rich = 'Here is a small example.\n\n```typescript\nconst message: string = "Hello";\nconsole.log(message);\n```\n\n$$x^2 + y^2 = z^2$$\n\n```mermaid\ngraph LR\n A[Your message] --> B[ONE ROUTER]\n B --> C[Your model]\n```';
const hostile = '###\tHeading\n\n<img src="//example.com/leak" onerror="document.documentElement.dataset.executed=1">\n\n[Open](javascript:alert(1))\n\n$$\\href{javascript:alert(1)}{unsafe}$$\n\n```mermaid\ngraph LR\n A@{ img: "relative.png" }\n```';

function fixture(body) {
  if (body.includes('render-slow-fixture')) return { content: 'Partial fixture response', slow: true };
  if (body.includes('render-hostile-fixture')) return { content: hostile };
  if (body.includes('render-rich-fixture')) return { content: rich };
  return { content: 'Fixture reply.' };
}

function event(response, content) {
  response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`);
  if (request.method === 'GET' && url.pathname === '/api/tags') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ models: [{ name: 'fixture-model' }] }));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/v1/models') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: [{ id: 'fixture-model' }] }));
    return;
  }
  if (request.method !== 'POST' || url.pathname !== '/chat/completions') {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 2 * 1024 * 1024) request.destroy();
  });
  request.on('end', () => {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const selected = fixture(body);
    event(response, selected.content);
    if (!selected.slow) {
      response.end('data: [DONE]\n\n');
      return;
    }
    const timer = setTimeout(() => {
      event(response, ' finished');
      response.end('data: [DONE]\n\n');
    }, 4000);
    response.on('close', () => clearTimeout(timer));
  });
});

server.listen(port, () => {
  console.log(`Provider stub on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
