/**
 * GET /api/debug/db — Check if the app can read from DB (D1 or mongoose/URI).
 */
import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
	const configured = db.isConfigured(event)
	let hasRecentMeasurement = false
	let error: string | undefined

	if (configured) {
		try {
			const doc = await db.findOne(event, {})
			hasRecentMeasurement = !!doc?.json
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		}
	}

	const config = useRuntimeConfig()
	const useUri = Boolean((config.mongoUrl as string)?.trim())
	// If db is configured and no URI is present, we infer D1
	const useD1 = configured && !useUri
	const connectionLabel = useD1 ? 'd1' : useUri ? 'mongoose_uri' : 'none'

	return {
		connectionState: configured ? 1 : 0,
		connectionLabel,
		hasRecentMeasurement,
		error: error ?? undefined,
	}
})
