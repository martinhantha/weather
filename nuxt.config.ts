// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	// devtools: { enabled: true },

	runtimeConfig: {
		mongoUrl: process.env.MONGODB_URI,
		apiSecret: process.env.API_SECRET,
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
