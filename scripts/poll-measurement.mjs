/**
 * Poll /api/cron/measurement every 2 seconds (Cloudflare cron cannot do sub-minute).
 * Run on a machine that stays on (e.g. Raspberry Pi, VPS): yarn poll:measurement
 * Requires: API_URL, CRON_SECRET in env (e.g. node --env-file=.env scripts/poll-measurement.mjs)
 */
const INTERVAL_MS = 2000

const apiUrl = process.env.API_URL?.replace(/\/$/, '')
const secret = process.env.CRON_SECRET
if (!apiUrl || !secret) {
	console.error('Set API_URL and CRON_SECRET (e.g. node --env-file=.env scripts/poll-measurement.mjs)')
	process.exit(1)
}

const url = `${apiUrl}/api/cron/measurement?secret=${encodeURIComponent(secret)}`

async function tick() {
	try {
		const res = await fetch(url, { method: 'GET' })
		if (!res.ok) {
			console.warn(`[poll] ${res.status} ${res.statusText}`)
		}
	} catch (err) {
		console.warn('[poll]', err.message ?? err)
	}
}

console.log(`[poll] Every ${INTERVAL_MS}ms: ${apiUrl}/api/cron/measurement`)
setInterval(tick, INTERVAL_MS)
tick()
