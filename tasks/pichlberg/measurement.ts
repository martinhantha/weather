/**
 * Nitro scheduled task: fetch Pichlberg and POST to /api/measurement.
 * Runs on Cloudflare Cron Trigger (see nuxt.config nitro.scheduledTasks).
 * Uses public.apiUrl as base for self-POST (set to your Pages URL, e.g. https://weather.hantha.digital).
 */
import { readSaveMeasurement } from '../../server/utils/readSaveMeasurement'

export default defineTask({
	meta: {
		name: 'pichlberg:measurement',
		description: 'Fetch Pichlberg current_conditions and save to /api/measurement',
	},
	async run({ context }) {
		// const config = useRuntimeConfig()
		// const baseUrl = (config.public?.apiUrl as string)?.trim() || ''
		// const result = await readSaveMeasurement(baseUrl || undefined)
		// if (!result.ok) {
		// 	throw new Error(result.error ?? 'readSaveMeasurement failed')
		// }
        console.log('measurement task');
		return { result: 'ok' }
	},
})
