/**
 * Last 24h of Pioupiou wind in 10-minute slots (same shape as /api/measurement/history).
 * Query: stationId (default: 2163).
 */
import { loadPioupiouHistory } from '../../utils/pioupiouHistory'

const HOURS_24_SEC = 24 * 60 * 60

export default defineEventHandler(async (event) => {
	const stationId = ((getQuery(event).stationId as string | undefined) ?? '2163').trim()
	const to = Math.floor(Date.now() / 1000)
	const from = to - HOURS_24_SEC
	try {
		const points = await loadPioupiouHistory(stationId, from, to)
		return { from, to, points }
	} catch (err) {
		console.error('[pioupiou/history] Failed to load wind history:', err)
		setResponseStatus(event, 502)
		return { error: 'Failed to load wind history.' }
	}
})
