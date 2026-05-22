/**
 * Proxy to Pioupiou / OpenWindMap Live API.
 *
 * Query: stationId (default: 2163).
 * Docs: https://developers.pioupiou.fr/api/live/
 * Wind speeds are km/h; poll at most every 60s.
 */
import type { ICondition } from '~/types'

type PioupiouLiveResponse = {
	data?: {
		id?: number
		measurements?: {
			date?: string
			wind_heading?: number | null
			wind_speed_avg?: number | null
			wind_speed_max?: number | null
			wind_speed_min?: number | null
		}
		status?: { state?: string | null }
	}
	error_code?: string
	error_message?: string
}

type PioupiouCurrentOut = { ts: number; condition: Partial<ICondition> }

type FetchResult =
	| { status: 200; data: PioupiouCurrentOut }
	| {
			status: number
			data: {
				error: string
				stationId: string
				detail?: unknown
			}
	  }

const CACHE_TTL_MS = Number(process.env.PIOUPIOU_CURRENT_CACHE_TTL_MS) || 60_000
const ERROR_CACHE_TTL_MS = Number(process.env.PIOUPIOU_CURRENT_ERROR_CACHE_TTL_MS) || 300_000

function getCacheKey(stationId: string) {
	return `pioupiou-current:${stationId}`
}

const cacheMap = ((globalThis as any).__pioupiouCurrentCache ??= new Map<
	string,
	{ expiresAt: number; result: FetchResult }
>()) as Map<string, { expiresAt: number; result: FetchResult }>

const inflightMap = ((globalThis as any).__pioupiouCurrentInflight ??= new Map<
	string,
	Promise<FetchResult>
>()) as Map<string, Promise<FetchResult>>

function mapPioupiouToCondition(m: NonNullable<PioupiouLiveResponse['data']>['measurements']): Partial<ICondition> {
	if (!m) return {}
	const heading = typeof m.wind_heading === 'number' ? m.wind_heading : undefined
	const avg = typeof m.wind_speed_avg === 'number' ? m.wind_speed_avg : undefined
	const max = typeof m.wind_speed_max === 'number' ? m.wind_speed_max : undefined
	return {
		wind_dir_last: heading,
		wind_dir_scalar_avg_last_10_min: heading,
		wind_speed_last: avg,
		wind_speed_avg_last_10_min: avg,
		wind_speed_hi_last_10_min: max,
	}
}

export default defineEventHandler(async (event) => {
	try {
		const query = getQuery(event)
		const stationId = ((query.stationId as string | undefined) ?? '2163').trim()

		const cacheKey = getCacheKey(stationId)
		const now = Date.now()

		const cached = cacheMap.get(cacheKey)
		if (cached && cached.expiresAt > now) {
			setResponseStatus(event, cached.result.status)
			return cached.result.data
		}

		const inflight = inflightMap.get(cacheKey)
		if (inflight) {
			const res = await inflight
			setResponseStatus(event, res.status)
			return res.data
		}

		const promise = (async (): Promise<FetchResult> => {
			try {
				const raw = await $fetch<PioupiouLiveResponse>(
					`http://api.pioupiou.fr/v1/live/${encodeURIComponent(stationId)}`,
					{ headers: { Accept: 'application/json' } },
				)

				const data = raw?.data
				const measurements = data?.measurements
				const dateStr = measurements?.date
				if (!dateStr) {
					return {
						status: 502,
						data: {
							error: 'Pioupiou invalid response (missing measurements.date)',
							stationId,
						},
					}
				}

				const ts = Math.floor(new Date(dateStr).getTime() / 1000)
				if (!Number.isFinite(ts)) {
					return {
						status: 502,
						data: {
							error: 'Pioupiou invalid measurement date',
							stationId,
						},
					}
				}

				return {
					status: 200,
					data: { ts, condition: mapPioupiouToCondition(measurements) },
				}
			} catch (e: any) {
				const status = typeof e?.statusCode === 'number' ? e.statusCode : 502
				return {
					status,
					data: {
						error: 'Pioupiou API unavailable',
						stationId,
						detail: e?.data ?? e?.message ?? e,
					},
				}
			}
		})()

		inflightMap.set(cacheKey, promise)
		try {
			const res = await promise
			const ttl = res.status === 200 ? CACHE_TTL_MS : ERROR_CACHE_TTL_MS
			cacheMap.set(cacheKey, { expiresAt: now + ttl, result: res })
			setResponseStatus(event, res.status)
			return res.data
		} finally {
			inflightMap.delete(cacheKey)
		}
	} catch (e: any) {
		setResponseStatus(event, 502)
		return {
			error: 'Pioupiou handler failed',
			stationId: ((getQuery(event).stationId as string | undefined) ?? '2163').trim(),
			detail: e?.message ?? String(e),
		}
	}
})
