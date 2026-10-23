import * as db from '../../utils/db'
import type { H3Event } from 'h3'
import { windDirDeg } from '../../../shared/windDisplay'

const HOURS_24_SEC = 24 * 60 * 60
const RECENT_MEASUREMENT_LIMIT = 400

type WindHistoryPoint = {
	ts: number
	max: number | null
	average: number | null
	/** Wind-from direction in degrees, already corrected for Pichlberg. */
	dir: number | null
}

type WindHistoryResponse = {
	from: number
	to: number
	points: WindHistoryPoint[]
}

type WindHistoryFallbackResponse = WindHistoryResponse | { error: string }

function directionDeg(condition: Record<string, unknown>): number | null {
	const raw = Number(condition.wind_dir_scalar_avg_last_10_min ?? condition.wind_dir_last)
	return Number.isFinite(raw) ? windDirDeg({ wind_dir_last: raw }, '33570') : null
}

function mphToKmh(value: unknown): number | null {
	if (value == null) return null
	const mph = Number(value)
	return Number.isFinite(mph) ? Math.round(mph * 1.609344) : null
}

async function loadConfiguredFallback(event: H3Event): Promise<WindHistoryResponse | null> {
	const apiUrl = (useRuntimeConfig().public?.apiUrl as string | undefined)?.trim()
	const isFallbackHop = getRequestHeader(event, 'x-wind-history-fallback') === '1'
	const requestHost = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '')
		.split(',')[0]
		.trim()
	if (!apiUrl || isFallbackHop) return null

	let apiIsSelf: boolean
	try {
		const host = new URL(apiUrl).host
		apiIsSelf = host === requestHost || host.startsWith('127.0.0.1') || host.startsWith('localhost')
	} catch {
		console.error('[measurement/history] Invalid API_URL; cannot request history fallback.')
		return null
	}
	if (apiIsSelf) return null

	try {
		const fallback = await $fetch<WindHistoryFallbackResponse>(
			`${apiUrl.replace(/\/$/, '')}/api/measurement/history`,
			{
				timeout: 8_000,
				headers: { Accept: 'application/json', 'x-wind-history-fallback': '1' },
			},
		)
		if ('points' in fallback && Array.isArray(fallback.points)) return fallback
		console.error('[measurement/history] Configured API_URL returned no wind history.')
	} catch (err) {
		console.error('[measurement/history] Configured API_URL history fallback failed:', err)
	}
	return null
}

export default defineEventHandler(async (event): Promise<WindHistoryFallbackResponse> => {
	if (!db.isConfigured(event)) {
		const fallback = await loadConfiguredFallback(event)
		if (fallback) return fallback
		setResponseStatus(event, 503)
		return { error: 'No database configured and no history fallback available.' }
	}

	try {
		const to = Math.floor(Date.now() / 1000)
		const from = to - HOURS_24_SEC
		const docs = await db.find(event, {}, { sort: { _id: -1 }, limit: RECENT_MEASUREMENT_LIMIT })
		const points: WindHistoryPoint[] = []

		for (const doc of docs) {
			if (!doc.json || typeof doc.json !== 'object') continue
			const data = (doc.json as { data?: { ts?: unknown; conditions?: Array<Record<string, unknown>> } }).data
			const ts = Number(data?.ts)
			const condition = data?.conditions?.[0]
			if (!Number.isFinite(ts) || ts < from || ts > to || !condition) continue

			points.push({
				ts,
				max: mphToKmh(condition.wind_speed_hi_last_10_min),
				average: mphToKmh(condition.wind_speed_avg_last_10_min),
				dir: directionDeg(condition),
			})
		}

		points.sort((a, b) => a.ts - b.ts)
		return { from, to, points }
	} catch (err) {
		console.error('[measurement/history] Failed to load wind history:', err)
		const fallback = await loadConfiguredFallback(event)
		if (fallback) return fallback
		setResponseStatus(event, 500)
		return { error: 'Failed to load wind history.' }
	}
})
