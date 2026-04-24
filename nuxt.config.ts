// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	// devtools: { enabled: true },

	// Avoids client fetches to `/_nuxt/builds/meta/*.json` (app manifest) which can return 500 in
	// dev and spam the console; you lose client-side routeRules from the manifest only.
	experimental: {
		appManifest: false,
	},

	runtimeConfig: {
		// MongoDB Atlas Data API (fetch) – works on Node and Cloudflare
		mongoDataApiAppId: process.env.MONGODB_APP_ID,
		mongoDataApiKey: process.env.MONGODB_API_KEY,
		mongoDataApiDataSource: process.env.MONGODB_DATA_SOURCE || 'Cluster0',
		mongoDataApiDatabase: process.env.MONGODB_DATABASE || 'mydb',
		/** Set to "true" or "1" to use Data API (App Services) even when MONGODB_URI is set */
		mongoUseDataApi: process.env.MONGODB_USE_DATA_API === 'true' || process.env.MONGODB_USE_DATA_API === '1',
		mongoUrl: process.env.MONGODB_URI,
		apiSecret: process.env.API_SECRET,
		cronSecret: process.env.CRON_SECRET,
		/** Server-only: Pichlberg live source. Used only by scheduler/cron, never exposed to browser. */
		weatherComApiKey: process.env.WEATHER_COM_API_KEY || 'dc72f42706974d37b2f4270697bd37d0',  //'b14f361ba4134ac38f361ba4135ac371',
		weatherlinkApiKey: process.env.WEATHERLINK_API_KEY || 'zcmyfzk32xr5itw5oplnxgmuwjby7sym',
		weatherlinkApiSecret: process.env.WEATHERLINK_API_SECRET || 'p0neabg9fxq6qngxhrf2h3fcfhnz2kbz',
		public: {
			apiUrl: process.env.API_URL,
		},
		app: {
			baseURL: '/',
		},
	},
	// `devServer.host` must be a hostname string (e.g. 'localhost', '0.0.0.0'), not `{ url }`.
	// Wrong config caused listhen "Invalid hostname [object Object]" and flaky API routes in dev.
	// Widget dev URL: set `VITE_API_URL` in widget/vite (see widget/README.md), not here.
	nitro: {
		plugins: ['~/server/index.ts'],
		// Use a Node-compatible preset so mongoose/mongodb can be bundled.
		// This avoids Cloudflare worker limitations and the "@mongodb-js/zstd" resolution error.
		preset: 'node-server',
		// Pin Nitro compatibility date to silence warnings and ensure stable runtime behavior
		compatibilityDate: '2026-03-18',
		experimental: {
			tasks: true,
		},
	},
	modules: ['nuxt-scheduler', '@nuxtjs/tailwindcss'],
	css: ['~/assets/css/tailwind.css'],
	tailwindcss: {
		exposeConfig: true,
		viewer: process.env.NODE_ENV === 'development',
		// and more...
	},
})
