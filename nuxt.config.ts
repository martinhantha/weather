// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	devtools: { enabled: true },
	runtimeConfig: {
		mongoUrl: process.env.MONGODB_URI,
		apiSecret: process.env.API_SECRET,
	},
	nitro: {
		plugins: ['~/server/index.ts'],
	},
	modules: ['nuxt-scheduler'],
})
