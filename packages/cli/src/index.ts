import { CliError, parseCommand } from './arguments';

declare const CLI_VERSION: string;

const help: Record<string, string> = {
  main: `Usage: one-router [command] [options]

Commands:
  serve                  Start the web UI and API (default)
  init                   Set up the owner, encryption key and provider presets
  config                 Show, locate or edit CLI settings
  user reset-password     Reset the owner password from this computer

Options:
  -h, --help             Show help; use <command> --help for options
  -v, --version          Print the installed version`,
  serve: `Usage: one-router serve [--host HOST] [--port PORT] [--api-only] [--no-open]

  --host HOST   Bind to this hostname or IP (default: 127.0.0.1)
  --port PORT   Start at this port and try the next one if busy (default: 3000)
  --api-only    Serve the gateway, auth, health and data APIs without the UI
  --no-open     Do not open the browser`,
  init: `Usage: one-router init

Choose an owner password and optional provider presets in a terminal. The
encryption key is generated and saved in the data directory unless configured
explicitly. Set INITIAL_PASSWORD for unattended initialization.`,
  config: `Usage: one-router config [--path | --print | --edit]

  --path   Print the path (default: ~/.one-router/config.json)
  --print  Print settings as JSON with secrets redacted (default)
  --edit   Open the file in VISUAL, EDITOR or the platform default

Override the path with ONE_ROUTER_CONFIG and the data directory with
ONE_ROUTER_DATA_DIR. Environment settings override matching JSON keys.`,
  user: `Usage: one-router user reset-password [--stdin]

Enter the new password in a hidden prompt or pipe one line with --stdin.
The reset revokes existing sessions and requires a change at the next login.`,
};

async function main() {
  const command = parseCommand(process.argv.slice(2));
  switch (command.command) {
    case 'version': return console.log(CLI_VERSION);
    case 'help': return console.log(help[command.topic ?? 'main']);
    case 'init': return (await import('./commands/init')).init(CLI_VERSION);
    case 'config': return (await import('./commands/config')).config(command);
    case 'serve': return (await import('./commands/serve')).serve(command, CLI_VERSION);
    case 'reset-password': return (await import('./commands/user')).resetPassword(command, CLI_VERSION);
  }
}

main().catch((error: unknown) => {
  console.error(`one-router: ${error instanceof CliError ? error.message : 'Command failed; check your local configuration'}`);
  process.exitCode = 1;
});
