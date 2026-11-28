import { spawn } from 'node:child_process';
import type { Command } from '../arguments';
import { runtimeConfig } from '../config';
import { serveApplication } from '../server';

function openBrowser(url: string) {
  const opener = process.platform === 'win32' ? ['rundll32.exe', 'url.dll,FileProtocolHandler'] :
    process.platform === 'darwin' ? ['open'] : ['xdg-open'];
  const browser = spawn(opener[0], [...opener.slice(1), url], { detached: true, stdio: 'ignore', windowsHide: true });
  browser.on('error', () => console.error('Could not open the browser; use the URL above'));
  browser.unref();
}

export async function serve(command: Extract<Command, { command: 'serve' }>, version: string) {
  const { env, host } = await runtimeConfig(version, command);
  await serveApplication({ env, host, apiOnly: command.apiOnly, onReady(port) {
    const browserHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host;
    const url = `http://${browserHost.includes(':') ? `[${browserHost}]` : browserHost}:${port}`;
    if (port !== env.port) console.log(`Port ${env.port} is in use; using ${port}`);
    console.log(`ONE ROUTER listening at ${url}${command.apiOnly ? ' (API only)' : ''}`);
    if (!command.noOpen && !command.apiOnly) openBrowser(url);
  } });
}
