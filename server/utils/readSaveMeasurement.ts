/**
 * Fetch Pichlberg data from pichlbergSourceUrl and POST to /api/measurement.
 * Only used by scheduler and cron — never call from browser or other routes.
 * @param baseUrl Optional origin (e.g. from getRequestURL(event).origin) for POST when in request context
 */
export async function readSaveMeasurement(baseUrl?: string): Promise<{ ok: boolean; error?: string }> {
	const sourceUrl = 'http://89.190.166.17:8081/v1/current_conditions'

	const raw = await $fetch(sourceUrl).catch((error: unknown) => {
		console.error('[readSaveMeasurement] fetch failed:', (error as { data?: unknown })?.data ?? error)
		return null
	})

	let response: unknown = raw
	if (typeof raw === 'string') {
		try {
			response = JSON.parse(raw)
		} catch (e) {
			console.error('[readSaveMeasurement] JSON parse failed:', e)
			return { ok: false, error: 'Invalid JSON from source' }
		}
	}

	if (!response || typeof response !== 'object') {
		return { ok: false, error: 'No JSON object from source' }
	}

	const measurementUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/measurement` : '/api/measurement'
	const result = await $fetch(measurementUrl, {
		method: 'post',
		body: { json: response },
	}).catch((e) => {
		console.error('[readSaveMeasurement] POST failed:', e)
		return null
	})

	if (!result) return { ok: false, error: 'Failed to POST measurement' }
	return { ok: true }
}
