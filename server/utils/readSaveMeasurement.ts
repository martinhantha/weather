/**
 * Fetch Pichlberg data and persist via POST /api/measurement (same flow as commit 11e07efe).
 */
function internalApiBase(): string {
	const config = useRuntimeConfig()
	const apiUrl = (config.public?.apiUrl as string | undefined)?.trim()
	if (apiUrl) return apiUrl.replace(/\/$/, '')
	const port = process.env.PORT || process.env.NITRO_PORT || 3000
	return `http://127.0.0.1:${port}`
}

export async function readSaveMeasurement(): Promise<{ ok: boolean; error?: string }> {
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

	const base = internalApiBase()
	try {
		await $fetch(`${base}/api/measurement`, {
			method: 'POST',
			body: { json: response },
		})
		return { ok: true }
	} catch (e: unknown) {
		const err = e as { data?: unknown; message?: string }
		console.error('[readSaveMeasurement] POST /api/measurement failed:', err?.data ?? err?.message ?? err)
		return { ok: false, error: 'POST failed' }
	}
}
