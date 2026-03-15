# Deploy to Cloudflare Pages

## Build & deploy

```bash
yarn deploy:cloudflare
```

Or manually (adjust branch and project name as needed):

```bash
yarn build
npx wrangler --cwd dist pages deploy . --branch master --project-name=weather
```

Preview locally: `yarn preview:cloudflare`.

## Environment variables (Cloudflare dashboard)

In **Pages → Your project → Settings → Environment variables**, set:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes (Node) | Connection string (mongoose). Use this when running on Node (nuxt dev, VPS). |
| `MONGODB_APP_ID` | Yes (CF) | Data API app ID (for Cloudflare Workers when not using URI). |
| `MONGODB_API_KEY` | Yes (CF) | Data API key (for Cloudflare). |
| `MONGODB_DATA_SOURCE` | No | Cluster name, default `Cluster0`. |
| `MONGODB_DATABASE` | No | Database name, default `mydb`. |
| `API_URL` | Yes | Your app URL, e.g. `https://weather.hantha.digital`. Used for wind-stations fallback and scheduled task self-POST. |
| `CRON_SECRET` | Yes | Secret for `/api/cron/measurement` (Bearer or `?secret=`). Use a long random string. |
| `PICHLBERG_SOURCE_URL` | No | Default: `https://weather.hantha.digital/v1/current_conditions`. Server-only. |
| `WEATHERLINK_API_KEY` | Yes | For WeatherLink API (Sattele, Pichlberg fallback). |
| `WEATHERLINK_API_SECRET` | Yes | For WeatherLink API. |

## Scheduled task (Pichlberg)

- **Every 2 seconds:** Cloudflare cron does **not** support seconds (minimum is 1 minute). To run every 2 seconds, use the **poller script** on a machine that stays on (e.g. Raspberry Pi, VPS):

  ```bash
  yarn poll:measurement
  ```

  Or with env vars: `API_URL=https://weather.hantha.digital CRON_SECRET=your-secret node scripts/poll-measurement.js`.  
  This calls **GET /api/cron/measurement** every 2 seconds. Keep it running in the background (e.g. `screen`, `tmux`, or a systemd service). (`yarn poll:measurement` uses `.env` and requires Node 20.6+.)

- **Every minute (Cloudflare only):** Nitro is configured with `scheduledTasks` and a **pichlberg:measurement** task. If your build’s `dist/_worker.js/wrangler.json` includes `triggers.crons`, the worker runs that task every minute. Otherwise use an external cron or a separate Worker with a [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) calling your `/api/cron/measurement` URL.

## Data

- **Node (nuxt dev, VPS):** Set **MONGODB_URI** in `.env` – the app uses mongoose with that URI.
- **Cloudflare:** Set **MONGODB_APP_ID** and **MONGODB_API_KEY** (Data API, fetch). On Workers, mongoose is stubbed; Data API is used if configured.
- Set **API_URL** to your Pages URL for the task and wind-stations fallback.

## Quick checklist

1. Set env vars (especially `MONGODB_APP_ID`, `MONGODB_API_KEY`, `API_URL`, `CRON_SECRET`, `WEATHERLINK_*`).
2. Deploy with `wrangler --cwd dist pages deploy ...`.
3. Optional: trigger `/api/cron/measurement` from an external cron if you want more than once per minute.
