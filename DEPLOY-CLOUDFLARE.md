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

## D1 database (Cloudflare)

The app uses **Cloudflare D1** for the measurement store on Cloudflare Pages. Set up once:

1. **Create the D1 database**
   ```bash
   npx wrangler d1 create weatherpichlberg
   ```
   Copy the printed `database_id` and set it as an environment variable (see below).

2. **Apply the schema**
   ```bash
   npx wrangler d1 execute weatherpichlberg --remote --file=./scripts/d1-schema.sql
   ```

3. **Set `CLOUDFLARE_D1_DATABASE_ID`** in the Cloudflare Pages project (Settings → Environment variables), or add the D1 binding in the dashboard: binding name `DB`, database name `weatherpichlberg`, and the same `database_id`.

4. **Import existing MongoDB data (optional)**  
   From a machine that can reach MongoDB and has `MONGODB_URI` in `.env`:
   ```bash
   node --env-file=.env scripts/import-mongo-to-d1.mjs
   npx wrangler d1 execute weatherpichlberg --remote --file=./scripts/import-output.sql
   ```
   The script reads the full `measurement` collection and writes `scripts/import-output.sql`; then apply it with wrangler.

## Environment variables (Cloudflare dashboard)

In **Pages → Your project → Settings → Environment variables**, set:

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_D1_DATABASE_ID` | Yes (CF) | D1 database ID from `wrangler d1 create weatherpichlberg`. Used for the `DB` binding. |
| `MONGODB_URI` | Yes (Node) | Connection string (mongoose). Use when running on Node (nuxt dev, VPS). |
| `MONGODB_APP_ID` | No (CF fallback) | Data API app ID if not using D1. |
| `MONGODB_API_KEY` | No (CF fallback) | Data API key if not using D1. |
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
- **Cloudflare:** Use **D1** (set `CLOUDFLARE_D1_DATABASE_ID`). The `DB` binding is used for measurement storage. If D1 is not configured, the app can fall back to MongoDB Data API (`MONGODB_APP_ID`, `MONGODB_API_KEY`).
- Set **API_URL** to your Pages URL for the task and wind-stations fallback.

## Quick checklist

1. Create D1 DB and apply schema (see **D1 database** above); set `CLOUDFLARE_D1_DATABASE_ID`.
2. Set env vars (especially `CLOUDFLARE_D1_DATABASE_ID`, `API_URL`, `CRON_SECRET`, `WEATHERLINK_*`).
3. Deploy with `wrangler --cwd dist pages deploy ...`.
4. Optional: run the MongoDB→D1 import script if you have existing measurement data.
5. Optional: trigger `/api/cron/measurement` from an external cron if you want more than once per minute.
