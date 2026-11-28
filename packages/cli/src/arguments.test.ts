import { describe, expect, it } from 'vitest';
import { parseCommand } from './arguments';

describe('CLI arguments', () => {
  it.each([
    [[], { command: 'serve', apiOnly: false, noOpen: false }],
    [['--api-only', '--port', '4000'], { command: 'serve', apiOnly: true, noOpen: false, port: 4000 }],
    [['serve', '--host=::1', '--no-open'], { command: 'serve', host: '::1', apiOnly: false, noOpen: true }],
    [['config', '--path'], { command: 'config', action: 'path' }],
    [['config'], { command: 'config', action: 'print' }],
    [['user', 'reset-password', '--stdin'], { command: 'reset-password', stdin: true }],
    [['init', '--help'], { command: 'help', topic: 'init' }],
    [['--version'], { command: 'version' }],
  ])('parses invocation %j', (args, result) => {
    expect(parseCommand(args)).toEqual(result);
  });

  it.each([
    ['unknown'], ['config', '--path', '--edit'], ['serve', '--port', '0'],
    ['serve', '--port=4e2'], ['serve', '--host=http://localhost'], ['user', '--stdin'],
  ])('rejects invalid arguments %j', (...args) => {
    expect(() => parseCommand(args)).toThrow();
  });
});
