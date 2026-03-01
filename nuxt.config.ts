// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	// devtools: { enabled: true },

	runtimeConfig: {
		mongoUrl: process.env.MONGODB_URI,
		apiSecret: process.env.API_SECRET,
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
			url: process.env.API_URL,
		},
	},
	nitro: {
		plugins: ['~/server/index.ts'],
	},
	modules: ['nuxt-scheduler', '@nuxtjs/tailwindcss'],
	css: ['~/assets/css/tailwind.css'],
	tailwindcss: {
		exposeConfig: true,
		viewer: true,
		// and more...
	},
})
