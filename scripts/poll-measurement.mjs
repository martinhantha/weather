/**
 * Poll /api/cron/measurement every 2 seconds (Cloudflare cron cannot do sub-minute).
 * Run on a machine that stays on (e.g. Raspberry Pi, VPS): yarn poll:measurement
 * Requires: API_URL, CRON_SECRET in env (e.g. node --env-file=.env scripts/poll-measurement.mjs)
 */
import fs from 'node:fs'

const INTERVAL_MS = 2000
const LOCK_PATH = '.poll-measurement.pid'

function acquireLockOrExit() {
	try {
		const fd = fs.openSync(LOCK_PATH, 'wx')
		fs.writeFileSync(fd, `${process.pid}\n`, 'utf8')
		fs.closeSync(fd)
	} catch (e) {
		if (e?.code !== 'EEXIST') throw e

		try {
			const pid = Number.parseInt(fs.readFileSync(LOCK_PATH, 'utf8').trim(), 10)
			const running = Number.isFinite(pid) && pid > 0
			console.error(`[poll] Already running (pid ${running ? pid : 'unknown'}). If it's stale, delete ${LOCK_PATH}.`)
		} catch {
			console.error(`[poll] Already running. If it's stale, delete ${LOCK_PATH}.`)
		}
		process.exit(0)
	}

	const cleanup = () => {
		try {
			const pid = Number.parseInt(fs.readFileSync(LOCK_PATH, 'utf8').trim(), 10)
			if (pid === process.pid) fs.unlinkSync(LOCK_PATH)
		} catch {
			// ignore
		}
	}

	process.on('exit', cleanup)
	process.on('SIGINT', () => process.exit(0))
	process.on('SIGTERM', () => process.exit(0))
	process.on('SIGHUP', () => process.exit(0))
}

acquireLockOrExit()

const apiUrl = process.env.API_URL?.replace(/\/$/, '')
const secret = process.env.CRON_SECRET
if (!apiUrl || !secret) {
	console.error('Set API_URL and CRON_SECRET (e.g. node --env-file=.env scripts/poll-measurement.mjs)')
	process.exit(1)
}

const url = `${apiUrl}/api/cron/measurement?secret=${encodeURIComponent(secret)}`

let inFlight = false
async function tick() {
	if (inFlight) return
	inFlight = true
	try {
		const res = await fetch(url, { method: 'GET' })
		if (!res.ok) {
			console.warn(`[poll] ${res.status} ${res.statusText}`)
		}
	} catch (err) {
		console.warn('[poll]', err.message ?? err)
	} finally {
		inFlight = false
	}
}

console.log(`[poll] Every ${INTERVAL_MS}ms: ${apiUrl}/api/cron/measurement`)
setInterval(tick, INTERVAL_MS)
tick()
