/**
 * GET /api/debug/db — Check if the app can read from DB (D1 or mongoose/URI).
 */
import * as db from '../../utils/db'
import * as dbD1 from '../../utils/db-d1'

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

	const useD1 = dbD1.isConfigured(event)
	const config = useRuntimeConfig()
	const useUri = Boolean((config.mongoUrl as string)?.trim())
	const connectionLabel = useD1 ? 'd1' : useUri ? 'mongoose_uri' : 'none'

	return {
		connectionState: configured ? 1 : 0,
		connectionLabel,
		hasRecentMeasurement,
		error: error ?? undefined,
	}
})
