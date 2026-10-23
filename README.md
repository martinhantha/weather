# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview

# bun
bun run preview
```

## Deploy to Coolify

Set `COOLIFY_DEPLOY_WEBHOOK_URL` and `COOLIFY_DEPLOY_TOKEN` in your local `.env` file. The webhook URL and token are credentials; do not commit them. See `.env.example` for the variable names.

Trigger the configured Coolify deployment with:

```bash
yarn deploy
```

The command asks for confirmation before triggering the webhook. Use `yarn deploy --yes` to skip the confirmation. Coolify deploys the branch configured for the application; this command does not commit or push local changes.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
