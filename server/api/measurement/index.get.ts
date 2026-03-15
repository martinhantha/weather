import * as db from '../../utils/db'

const DEBUG_LOG = (data: Record<string, unknown>) => {
	// #region agent log
	fetch('http://127.0.0.1:7491/ingest/bfe2b03b-e598-40e2-8df9-2a0a3917f88b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0bf217' }, body: JSON.stringify({ sessionId: '0bf217', location: 'measurement/index.get.ts', message: 'GET /api/measurement', data, timestamp: Date.now(), hypothesisId: data.hypothesisId as string }) }).catch(() => {})
	// #endregion
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const configured = db.isConfigured()
	DEBUG_LOG({ hypothesisId: 'A', configured, hasQueryMaxWind: Boolean(query.maxWind) })

	if (!configured) {
		DEBUG_LOG({ hypothesisId: 'A', path: 'early_return_null', reason: 'not_configured' })
		return null
	}

	try {
		const sortByTime = { _id: -1 as const }
		const sortByMaxWind = { 'json.data.conditions.0.wind_speed_hi_last_10_min': -1 as const }
		const useMaxWind = Boolean(query.maxWind)

		const docs = await db.find({}, { sort: useMaxWind ? sortByMaxWind : sortByTime, limit: 1 })
		const doc = docs[0]
		DEBUG_LOG({ hypothesisId: 'B', hypothesisId2: 'C', docsLength: docs.length, hasDoc: !!doc, docId: doc?._id })

		if (!doc) {
			DEBUG_LOG({ hypothesisId: 'B', hypothesisId2: 'C', path: 'return_null_no_doc' })
			return null
		}
		DEBUG_LOG({ hypothesisId: 'D', path: 'return_success', id: doc._id })
		return { id: doc._id, json: doc.json }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		DEBUG_LOG({ hypothesisId: 'D', path: 'catch', error: msg })
		console.error(err)
		setResponseStatus(event, 500)
		return { code: 'ERROR', message: 'Something wrong.' }
	}
})
