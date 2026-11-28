import { isIP } from 'node:net';
import { parseArgs, type ParseArgsConfig } from 'node:util';

export type Command =
  | { command: 'help'; topic?: string }
  | { command: 'version' }
  | { command: 'init' }
  | { command: 'config'; action: 'path' | 'print' | 'edit' }
  | { command: 'serve'; port?: number; host?: string; apiOnly: boolean; noOpen: boolean }
  | { command: 'reset-password'; stdin: boolean };

export function validateHost(host: string): string {
  if (!isIP(host) && !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(host)) {
    throw new CliError('Host must be a hostname or an IP address');
  }
  return host;
}

export class CliError extends Error {}

export function parseCommand(argv: string[]): Command {
  if (argv.length === 1 && ['--version', '-v'].includes(argv[0])) return { command: 'version' };
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { command: 'help' };

  const topic = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'serve';
  const args = topic === argv[0] ? argv.slice(1) : argv;
  const options: ParseArgsConfig['options'] = { help: { type: 'boolean', short: 'h' } };
  switch (topic) {
    case 'serve':
      Object.assign(options, {
        port: { type: 'string' }, host: { type: 'string' },
        'api-only': { type: 'boolean' }, 'no-open': { type: 'boolean' },
      });
      break;
    case 'config':
      Object.assign(options, { path: { type: 'boolean' }, print: { type: 'boolean' }, edit: { type: 'boolean' } });
      break;
    case 'user':
      if (args[0] === 'reset-password') args.shift();
      else if (args.length !== 1 || !['-h', '--help'].includes(args[0])) {
        throw new CliError('Use one-router user reset-password');
      }
      options.stdin = { type: 'boolean' };
      break;
    case 'init':
      break;
    default:
      throw new CliError('Unknown command; see one-router --help');
  }

  let values;
  try {
    ({ values } = parseArgs({ args, options }));
  } catch {
    throw new CliError(`Invalid arguments; see one-router ${topic} --help`);
  }
  if (values.help) return { command: 'help', topic };
  if (topic === 'init') return { command: 'init' };
  if (topic === 'user') return { command: 'reset-password', stdin: values.stdin === true };
  if (topic === 'config') {
    if ([values.path, values.edit, values.print].filter(Boolean).length > 1) {
      throw new CliError('Choose one of --path, --print or --edit');
    }
    return { command: 'config', action: values.path ? 'path' : values.edit ? 'edit' : 'print' };
  }

  const port = typeof values.port === 'string' ? Number(values.port) : undefined;
  if (port !== undefined && (!/^\d+$/.test(String(values.port)) || port < 1 || port > 65535)) {
    throw new CliError('Port must be an integer between 1 and 65535');
  }
  const host = typeof values.host === 'string' ? validateHost(values.host) : undefined;
  return {
    command: 'serve', ...(port === undefined ? {} : { port }), ...(host === undefined ? {} : { host }),
    apiOnly: values['api-only'] === true, noOpen: values['no-open'] === true,
  };
}
