# onerouter

Run the ONE ROUTER AI chat workspace and OpenAI-compatible gateway on your machine. Requires Node.js 24 or newer.

Run `npx onerouter` for a local session, or `npm i -g onerouter` to install both the `one-router` and `onerouter` commands. Open the URL printed in the terminal, sign in with the first-run password, and change it when prompted.

- `one-router --help`: see commands and flags.
- `one-router serve --api-only --no-open`: run the gateway without the chat UI.
- `one-router config --path`: find the active config file.
- `one-router user reset-password`: recover the owner account with the existing database and key.

[Documentation](https://one-router-lac.vercel.app/docs/) · [Source](https://github.com/Emmraan/one-router) · [MIT License](./LICENSE)
