import manifest from './docs-commands.json' with { type: 'json' };

const id = process.argv[2];
if (!Object.hasOwn(manifest, id)) throw new Error(`Unknown documentation command ${id}`);
console.log(manifest[id].command);
