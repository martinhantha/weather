/**
 * GET /api/debug/db — Check if the app can read from MongoDB (URI/mongoose or Data API).
 */
import * as db from '../../utils/db'

export default defineEventHandler(async () => {
	const configured = db.isConfigured()
	let hasRecentMeasurement = false
	let error: string | undefined

	if (configured) {
		try {
			const doc = await db.findOne({})
			hasRecentMeasurement = !!doc?.json
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		}
	}

	const config = useRuntimeConfig()
	const useUri = Boolean((config.mongoUrl as string)?.trim())

	return {
		connectionState: configured ? 1 : 0,
		connectionLabel: useUri ? 'mongoose_uri' : 'data_api',
		hasRecentMeasurement,
		error: error ?? undefined,
	}
})
