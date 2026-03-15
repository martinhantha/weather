import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)

	if (!db.isConfigured(event)) {
		setResponseStatus(event, 503)
		return { ok: false, error: 'No database configured. Set MONGODB_URI (local/Node) or deploy with D1 binding (Cloudflare).' }
	}

	try {
		const sortByTime = { _id: -1 as const }
		const sortByMaxWind = { 'json.data.conditions.0.wind_speed_hi_last_10_min': -1 as const }
		const useMaxWind = Boolean(query.maxWind)

		const docs = await db.find(event, {}, { sort: useMaxWind ? sortByMaxWind : sortByTime, limit: 1 })
		const doc = docs[0]

		if (!doc) return null
		return { id: doc._id, json: doc.json }
	} catch (err) {
		console.error(err)
		setResponseStatus(event, 500)
		return { code: 'ERROR', message: 'Something wrong.' }
	}
})
