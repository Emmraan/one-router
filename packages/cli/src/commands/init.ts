import { PROVIDER_DEFAULTS, PROVIDER_TYPES, type ProviderType } from '@one-router/core';
import { createRepositories } from '@one-router/db';
import { bootstrapDatabase } from '@one-router/server';
import { CliError } from '../arguments';
import { runtimeConfig } from '../config';
import { reportBootstrap } from '../logger';
import { prompt, promptPassword, validatePassword } from '../prompt';

async function detectOllama() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/version', {
      signal: AbortSignal.timeout(1500), redirect: 'error',
    });
    await response.body?.cancel();
    return response.ok && Boolean(response.headers.get('content-type')?.startsWith('application/json'));
  } catch {
    return false;
  }
}

export async function init(version: string) {
  const { env } = await runtimeConfig(version);
  const interactive = process.stdin.isTTY && process.stderr.isTTY;
  if (env.initialPassword) validatePassword(env.initialPassword);
  else if (interactive) env.initialPassword = await promptPassword();
  else throw new CliError('Run init in a terminal or set INITIAL_PASSWORD for unattended setup');

  const presets = new Set<ProviderType>();
  if (interactive) {
    const choices = await prompt(`Provider presets (${PROVIDER_TYPES.join(', ')}; comma-separated or blank): `);
    for (const name of choices.toLowerCase().split(',').map((value) => value.trim()).filter(Boolean)) {
      const type = PROVIDER_TYPES.find((type) => type === name);
      if (!type) throw new CliError('Unknown provider preset');
      presets.add(type);
    }
    if (/^y(es)?$/i.test((await prompt('Check for Ollama on this computer? [y/N] ')).trim())) {
      if (await detectOllama()) {
        console.log('Ollama detected; enabling its preset.');
        presets.add('ollama');
      } else console.log('Ollama was not detected.');
    }
  }

  const { db, seeded } = await bootstrapDatabase(env);
  try {
    reportBootstrap(seeded, env.dataDir, true);
    if (!seeded.created) console.log('Owner already exists; the password is unchanged.');
    const repo = createRepositories(db).providers;
    for (const type of presets) {
      const id = `preset-${type}`;
      if (await repo.get(seeded.user.id, id)) continue;
      try {
        await repo.create(seeded.user.id, { ...PROVIDER_DEFAULTS[type], id, type, isActive: true });
      } catch (error) {
        if (!await repo.get(seeded.user.id, id)) throw error;
      }
    }
    console.log('Setup complete. Run one-router serve.');
  } finally {
    db.close();
  }
}
