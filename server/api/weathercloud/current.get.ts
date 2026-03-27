/**
 * Proxy to Weathercloud device values.
 *
 * Query: deviceId (default: 9123924154).
 * Returns normalized object compatible with frontend (same shape as WeatherLink condition).
 */
import type { ICondition } from '~/types'
import { fetchWeathercloudValues } from '../../utils/weathercloud'

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
	// Weathercloud `wspd` is m/s (same as weathercloud-js chillFn using wspd * 3.6).
	return Math.round(num * 3.6)
}

export default defineEventHandler(async (event) => {
	try {
		const query = getQuery(event)
		const deviceId = ((query.deviceId as string | undefined) ?? '9123924154').trim()

		const cacheKey = getCacheKey(deviceId)
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
				const res = await fetchWeathercloudValues(deviceId)
				if (!res || typeof res !== 'object' || 'error' in res) {
					return {
						status: 502,
						data: {
							error: 'Weathercloud API unavailable',
							deviceId,
							detail: (res as { error?: unknown })?.error ?? res,
						},
					}
				}

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
					wind_speed_last: typeof (res as any).wspd === 'number' ? mpsToKmh((res as any).wspd) : undefined,
					wind_speed_hi_last_10_min:
						typeof (res as any).wspdhi === 'number' ? mpsToKmh((res as any).wspdhi) : undefined,
					wind_speed_avg_last_10_min:
						typeof (res as any).wspdavg === 'number' ? mpsToKmh((res as any).wspdavg) : undefined,
					wind_dir_last: typeof (res as any).wdir === 'number' ? (res as any).wdir : undefined,
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
	} catch (e: any) {
		setResponseStatus(event, 502)
		return {
			error: 'Weathercloud handler failed',
			deviceId: ((getQuery(event).deviceId as string | undefined) ?? '9123924154').trim(),
			detail: e?.message ?? String(e),
		}
	}
})
