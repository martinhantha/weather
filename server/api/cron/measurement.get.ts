/**
 * Cron endpoint: trigger Pichlberg fetch and save to measurement.
 * Call every 2s from the poller script (Cloudflare cron is minutely only).
 * Auth: CRON_SECRET via ?secret=... or Authorization: Bearer <secret>
 */
import { readSaveMeasurement } from '../../utils/readSaveMeasurement'

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	const secret = (config.cronSecret as string)?.trim()
	if (!secret) {
		setResponseStatus(event, 503)
		return { ok: false, error: 'CRON_SECRET not set' }
	}

	const querySecret = getQuery(event).secret as string | undefined
	const authHeader = getHeader(event, 'authorization')
	const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
	const provided = querySecret ?? bearerSecret
	if (provided !== secret) {
		setResponseStatus(event, 401)
		return { ok: false, error: 'Unauthorized' }
	}

	const baseUrl = (config.public?.apiUrl as string)?.trim() || getRequestURL(event).origin
	const result = await readSaveMeasurement(baseUrl)
	if (!result.ok) {
		setResponseStatus(event, 502)
		return { ok: false, error: result.error ?? 'readSaveMeasurement failed' }
	}
	return { ok: true }
})
