/**
 * Nitro scheduled task: fetch Pichlberg and persist (same as readSaveMeasurement).
 */
import { readSaveMeasurement } from '../../server/utils/readSaveMeasurement'

export default defineTask({
	meta: {
		name: 'pichlberg:measurement',
		description: 'Fetch Pichlberg current_conditions and save to DB',
	},
	async run() {
		const result = await readSaveMeasurement()
		if (!result.ok) {
			throw new Error(result.error ?? 'readSaveMeasurement failed')
		}
		return { result: 'ok' }
	},
})
