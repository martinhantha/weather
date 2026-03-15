// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	// devtools: { enabled: true },

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
		pichlbergSourceUrl: process.env.PICHLBERG_SOURCE_URL || 'https://weather.hantha.digital/v1/current_conditions',
		weatherComApiKey: process.env.WEATHER_COM_API_KEY || 'ad186c83f1ab43b1986c83f1aba3b1b4',
		weatherlinkApiKey: process.env.WEATHERLINK_API_KEY || 'zcmyfzk32xr5itw5oplnxgmuwjby7sym',
		weatherlinkApiSecret: process.env.WEATHERLINK_API_SECRET || 'p0neabg9fxq6qngxhrf2h3fcfhnz2kbz',
		public: {
			apiUrl: process.env.API_URL,
		},
		app: {
			baseURL: '/',
		},
	},
	devServer: {
		host: {
			url: process.env.VITE_API_URL || 'http://localhost:3000',
		},
	},
	nitro: {
		plugins: ['~/server/index.ts'],
		preset: 'cloudflare_pages',
		compatibilityDate: '2024-09-23',
		experimental: {
			tasks: true,
		},
		// Cloudflare Cron Trigger: fetch Pichlberg every minute (min interval on CF)
		scheduledTasks: {
			'* * * * *': ['pichlberg:measurement'],
		},
		cloudflare: {
			nodeCompat: true,
			deployConfig: true,
			wrangler: {
				triggers: { crons: ['* * * * *'] },
			},
		},
		// Stub mongoose/mongodb for Cloudflare build (no TCP on Workers); Node uses real mongoose with MONGODB_URI
		alias: {
			'mongoose': './server/utils/mongoose-cloudflare-stub.ts',
			'mongodb': './server/utils/mongodb-cloudflare-stub.ts',
			'@mongodb-js/zstd': './server/utils/zstd-stub.ts',
			'gcp-metadata': './server/utils/zstd-stub.ts',
			'snappy': './server/utils/zstd-stub.ts',
			'socks': './server/utils/zstd-stub.ts',
			'@aws-sdk/credential-providers': './server/utils/zstd-stub.ts',
			'aws4': './server/utils/zstd-stub.ts',
			'kerberos': './server/utils/zstd-stub.ts',
			'mongodb-client-encryption': './server/utils/zstd-stub.ts',
		},
	},
	modules: ['nuxt-scheduler', '@nuxtjs/tailwindcss'],
	css: ['~/assets/css/tailwind.css'],
	tailwindcss: {
		exposeConfig: true,
		viewer: true,
		// and more...
	},
})
