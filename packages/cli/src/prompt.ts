import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { assessPassword } from '@one-router/server';
import { CliError } from './arguments';

export async function prompt(question: string, secret = false): Promise<string> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new CliError('An interactive terminal is required');
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  if (secret) process.stderr.write(question);
  const readline = createInterface({ input: process.stdin, output: secret ? output : process.stderr,
    terminal: true, historySize: 0 });
  const cancel = new AbortController();
  const abort = () => cancel.abort();
  readline.once('SIGINT', abort);
  readline.once('close', abort);
  try {
    return await readline.question(secret ? '' : question, { signal: cancel.signal });
  } catch {
    throw new CliError('Input cancelled');
  } finally {
    readline.close();
    if (secret) process.stderr.write('\n');
  }
}

export function validatePassword(password: string): string {
  const { issues } = assessPassword(password);
  if (issues.length) throw new CliError(issues.join('. '));
  return password;
}

export async function promptPassword(): Promise<string> {
  const password = validatePassword(await prompt('Owner password: ', true));
  if (password !== await prompt('Confirm owner password: ', true)) throw new CliError('Passwords do not match');
  return password;
}

export async function passwordFromStdin(): Promise<string> {
  if (process.stdin.isTTY) throw new CliError('Pipe a password to --stdin or omit the flag for a hidden prompt');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 1026) throw new CliError('Password must be at most 1024 UTF-8 bytes');
    chunks.push(bytes);
  }
  let password: string;
  try {
    password = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks)).replace(/\r?\n$/, '');
  } catch {
    throw new CliError('Password must be valid UTF-8');
  }
  if (/[\r\n]/.test(password)) throw new CliError('Supply one password on standard input');
  return validatePassword(password);
}
