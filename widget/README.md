# Weather widget (embed script)

Build a single JS bundle that can be included on any website and mounted into a div (no iframe).

## Build

From repo root:

```bash
yarn build:widget   # widget only
yarn build          # widget + Nuxt app (use this on Cloudflare)
```

`yarn build` runs the widget build first, then Nuxt. So on **Cloudflare Pages** use build command **`yarn build`** (or `npm run build`); the widget is built and copied into `public/`, and Nuxt includes it in the deployment. No extra steps needed.

## Embed on a website

1. Load the script (and optional CSS if you use a separate stylesheet build).
2. Add a container div.
3. Call `WeatherWidget.mount(selector, { apiUrl })`.

Example:

```html
<div id="weather-widget"></div>
<script src="https://your-weather-app.pages.dev/weather-widget.js"></script>
<script>
  WeatherWidget.mount('#weather-widget', {
    apiUrl: 'https://your-weather-app.pages.dev'
  });
</script>
```

- **apiUrl** (required): base URL of your weather API (same origin as where you host the script, or another deployment). The widget will request `/api/measurement`, `/api/wind-stations`, `/api/southtyrol/sensors`, etc. from this base.

## Dev

```bash
cd widget && yarn dev
```

Then open the dev page and set `VITE_API_URL` if your API runs elsewhere (e.g. `http://localhost:3000`).
