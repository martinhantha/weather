/**
 * Fetch Pichlberg data and persist via POST /api/measurement (same flow as commit 11e07efe).
 * A dead station must not stall the server: short timeout, then back off.
 */
const SOURCE_TIMEOUT_MS = 5_000
const FAIL_BACKOFF_MS = 30_000
let backoffUntil = 0

function internalApiBase(): string {
	const config = useRuntimeConfig()
	const apiUrl = (config.public?.apiUrl as string | undefined)?.trim()
	if (apiUrl) return apiUrl.replace(/\/$/, '')
	const port = process.env.PORT || process.env.NITRO_PORT || 3000
	return `http://127.0.0.1:${port}`
}

export async function readSaveMeasurement(): Promise<{ ok: boolean; error?: string }> {
	if (Date.now() < backoffUntil) {
		return { ok: false, error: 'Pichlberg unreachable' }
	}

	// Direct station URL is only reachable from 45.144.187.11.
	// Elsewhere set PICHBERG_SOURCE_URL to the PHP proxy on that host (pichlberg.php).
	const sourceUrl =
		process.env.PICHBERG_SOURCE_URL?.trim() ||
		'http://89.190.166.17:8081/v1/current_conditions'

	let raw: unknown
	try {
		raw = await $fetch(sourceUrl, { timeout: SOURCE_TIMEOUT_MS })
	} catch (error: unknown) {
		backoffUntil = Date.now() + FAIL_BACKOFF_MS
		console.error('[readSaveMeasurement] fetch failed:', (error as { data?: unknown })?.data ?? error)
		return { ok: false, error: 'Pichlberg unreachable' }
	}

	let response: unknown = raw
	if (typeof raw === 'string') {
		try {
			response = JSON.parse(raw)
		} catch (e) {
			backoffUntil = Date.now() + FAIL_BACKOFF_MS
			console.error('[readSaveMeasurement] JSON parse failed:', e)
			return { ok: false, error: 'Invalid JSON from source' }
		}
	}

	if (!response || typeof response !== 'object') {
		backoffUntil = Date.now() + FAIL_BACKOFF_MS
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
