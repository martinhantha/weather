/**
 * Proxy to Weathercloud device values.
 *
 * Query: deviceId (default: 9123924154).
 * Returns normalized object compatible with frontend (same shape as WeatherLink condition).
 */
import { getWeather } from 'weathercloud-js'
import type { ICondition } from '~/types'

type WeathercloudCurrentOut = { ts: number; condition: Partial<ICondition> }

type FetchResult =
	| { status: 200; data: WeathercloudCurrentOut }
	| {
			status: number
			data: {
				error: string
				deviceId: string
				detail?: unknown
			}
	  }

const CACHE_TTL_MS = Number(process.env.WEATHERCLOUD_CURRENT_CACHE_TTL_MS) || 60_000
const ERROR_CACHE_TTL_MS = Number(process.env.WEATHERCLOUD_CURRENT_ERROR_CACHE_TTL_MS) || 300_000

function getCacheKey(deviceId: string) {
	return `weathercloud-current:${deviceId}`
}

const cacheMap = ((globalThis as any).__weathercloudCurrentCache ??= new Map<
	string,
	{ expiresAt: number; result: FetchResult }
>()) as Map<string, { expiresAt: number; result: FetchResult }>

const inflightMap = ((globalThis as any).__weathercloudCurrentInflight ??= new Map<
	string,
	Promise<FetchResult>
>()) as Map<string, Promise<FetchResult>>

function mpsToKmh(num: number): number {
	// weathercloud-js treats `wspd` as m/s (see chillFn uses `wspd * 3.6`)
	return Math.round(num * 3.6)
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const deviceId = ((query.deviceId as string | undefined) ?? '9123924154').trim()

	const cacheKey = getCacheKey(deviceId)
	const now = Date.now()

	// 1) Serve cached data to all users (success or cached upstream errors).
	const cached = cacheMap.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		setResponseStatus(event, cached.result.status)
		return cached.result.data
	}

	// 2) If an upstream request is already in flight for this station,
	//    await it instead of starting a new one (prevents request storms).
	const inflight = inflightMap.get(cacheKey)
	if (inflight) {
		const res = await inflight
		setResponseStatus(event, res.status)
		return res.data
	}

	// 3) Start exactly one upstream request and let all concurrent users share it.
	const promise = (async (): Promise<FetchResult> => {
		try {
			const res = await getWeather(deviceId as any)
			if (!res || typeof res !== 'object' || 'error' in res) {
				return {
					status: 502,
					data: {
						error: 'Weathercloud API unavailable',
						deviceId,
						detail: (res as any)?.error ?? res,
					},
				}
			}

			// weathercloud-js returns epoch and a set of value fields.
			const epoch = (res as any).epoch
			if (typeof epoch !== 'number') {
				return {
					status: 502,
					data: {
						error: 'Weathercloud invalid response (missing epoch)',
						deviceId,
					},
				}
			}

			const condition: Partial<ICondition> = {
				temp: typeof (res as any).temp === 'number' ? (res as any).temp : undefined,
				hum: typeof (res as any).hum === 'number' ? (res as any).hum : undefined,
				// weathercloud device values are in m/s; convert to km/h to match other providers.
				wind_speed_last: typeof (res as any).wspd === 'number' ? mpsToKmh((res as any).wspd) : undefined,
				wind_speed_hi_last_10_min:
					typeof (res as any).wspdhi === 'number' ? mpsToKmh((res as any).wspdhi) : undefined,
				wind_speed_avg_last_10_min:
					typeof (res as any).wspdavg === 'number' ? mpsToKmh((res as any).wspdavg) : undefined,
				wind_dir_last: typeof (res as any).wdir === 'number' ? (res as any).wdir : undefined,
				// Weathercloud exposes an averaged wind direction; use it for the "scalar" arrow.
				wind_dir_scalar_avg_last_10_min:
					typeof (res as any).wdiravg === 'number' ? (res as any).wdiravg : undefined,
			}

			return { status: 200, data: { ts: epoch, condition } }
		} catch (e: any) {
			return {
				status: 502,
				data: {
					error: 'Weathercloud API unavailable',
					deviceId,
					detail: e?.message || e,
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
})

