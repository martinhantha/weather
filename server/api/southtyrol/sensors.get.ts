/**
 * Proxy to South Tyrol Buergernetz sensors API.
 * Query: station_code (single) or station_codes (comma-separated).
 * Returns normalized object(s) compatible with frontend (same shape as WeatherLink condition).
 * Responses are cached (default 5 min) to limit upstream requests.
 *
 * daten.buergernetz.bz.it/services/meteo/v1/* is deprecated; use geoservices host
 * (see data.civis.bz.it dataset misure-meteo-e-idrografiche).
 */

const SOUTH_TIROL_SENSORS_URL = 'https://geoservices.buergernetz.bz.it/services/meteo/v1/sensors'

const CACHE_TTL_MS = Number(process.env.SOUTH_TIROL_SENSORS_CACHE_TTL_MS) || 300_000
const ERROR_CACHE_TTL_MS = Number(process.env.SOUTH_TIROL_SENSORS_ERROR_CACHE_TTL_MS) || 300_000

export interface ISouthTyrolSensorRow {
	TYPE: string
	VALUE: number
	DATE: string
}

/** Normalized station condition (same field names as ICondition where possible). */
export interface INormalizedSouthTyrolStation {
	ts: number
	temp?: number
	wind_speed_last?: number
	wind_speed_hi_last_10_min?: number
	wind_speed_avg_last_10_min?: number
	wind_dir_last?: number
}

type SensorsPayload = Record<string, INormalizedSouthTyrolStation> | INormalizedSouthTyrolStation

type FetchResult =
	| { status: 200; data: SensorsPayload }
	| { status: number; data: { error: string; detail?: unknown } }

function getCacheKey(codes: string[]) {
	return `southtyrol-sensors:${[...codes].sort().join(',')}`
}

const cacheMap = ((globalThis as any).__southTyrolSensorsCache ??= new Map<
	string,
	{ expiresAt: number; result: FetchResult }
>()) as Map<string, { expiresAt: number; result: FetchResult }>

const inflightMap = ((globalThis as any).__southTyrolSensorsInflight ??= new Map<
	string,
	Promise<FetchResult>
>()) as Map<string, Promise<FetchResult>>

function mpsToKmh(mps: number): number {
	return Math.round(Number(mps) * 3.6)
}

function normalizeSouthTyrolRows(rows: ISouthTyrolSensorRow[]): INormalizedSouthTyrolStation {
	const out: INormalizedSouthTyrolStation = { ts: 0 }
	for (const row of rows) {
		if (row.TYPE === 'LT' && row.VALUE != null) {
			out.temp = Number(row.VALUE)
			if (row.DATE) {
				const date = new Date(row.DATE.slice(0, 19))
				out.ts = Math.floor(date.getTime() / 1000)
			}
		}
		if (row.TYPE === 'WG') out.wind_speed_last = mpsToKmh(row.VALUE)
		if (row.TYPE === 'WG.BOE') out.wind_speed_hi_last_10_min = mpsToKmh(row.VALUE)
		if (row.TYPE === 'WR') out.wind_dir_last = Number(row.VALUE)
	}
	if (out.wind_speed_last != null && out.wind_speed_avg_last_10_min == null)
		out.wind_speed_avg_last_10_min = out.wind_speed_last
	return out
}

async function fetchStations(codes: string[]): Promise<Record<string, INormalizedSouthTyrolStation>> {
	const results: Record<string, INormalizedSouthTyrolStation> = {}
	await Promise.all(
		codes.map(async (code) => {
			try {
				const url = `${SOUTH_TIROL_SENSORS_URL}?station_code=${encodeURIComponent(code)}`
				const rows = await $fetch<ISouthTyrolSensorRow[]>(url)
				if (Array.isArray(rows)) results[code] = normalizeSouthTyrolRows(rows)
				else results[code] = { ts: 0 }
			} catch (e) {
				console.error(`South Tyrol sensors fetch failed for ${code}:`, e)
				results[code] = { ts: 0 }
			}
		}),
	)
	return results
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const stationCode = query.station_code as string | undefined
	const stationCodesParam = query.station_codes as string | undefined
	const codes: string[] = []
	if (stationCode) codes.push(stationCode)
	if (stationCodesParam) codes.push(...stationCodesParam.split(',').map((s) => s.trim()).filter(Boolean))

	if (codes.length === 0) {
		setResponseStatus(event, 400)
		return { error: 'Missing query: station_code or station_codes' }
	}

	const cacheKey = getCacheKey(codes)
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
			const results = await fetchStations(codes)
			const data: SensorsPayload = codes.length === 1 ? results[codes[0]!]! : results
			return { status: 200, data }
		} catch (e: any) {
			return {
				status: 502,
				data: { error: 'South Tyrol sensors fetch failed', detail: e?.message ?? e },
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
