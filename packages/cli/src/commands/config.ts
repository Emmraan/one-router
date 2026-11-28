import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CliError, type Command } from '../arguments';
import { printableSettings, readSettings } from '../config';
import { configPath } from '../paths';

export async function config({ action }: Extract<Command, { command: 'config' }>) {
  const path = configPath();
  if (action === 'path') {
    console.log(path);
    return;
  }
  if (action === 'print') {
    console.log(JSON.stringify(printableSettings(await readSettings()), null, 2));
    return;
  }

  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, '{}\n', { mode: 0o600, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new CliError('Could not create the configuration file');
  }
  const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad.exe' : 'vi');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(editor, [path], { stdio: 'inherit' });
    child.once('error', () => reject(new CliError('Could not start the editor; set VISUAL or EDITOR to an executable')));
    child.once('exit', (code) => code === 0 ? resolve() : reject(new CliError('The editor did not exit successfully')));
  });
}
