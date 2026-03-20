/**
 * Proxy to Weather.com v2 PWS (Personal Weather Station) current observations.
 * Set WEATHER_COM_API_KEY in .env (create/renew at developer.weather.com).
 * Query: stationId (default ISARNT29). Returns normalized condition for wind list/gauges.
 */
import type { ICondition } from '~/types'

const PWS_URL = 'https://api.weather.com/v2/pws/observations/current'

// Cache upstream Weather.com "current" responses so multiple users
// (and fast polling clients) don't trigger an upstream request each time.
const CACHE_TTL_MS = Number(process.env.PWS_OBSERVATIONS_CURRENT_CACHE_TTL_MS) || 60_000
/** Cache failed upstream responses (401, 404, 502) so polling clients don't hammer Weather.com or spam logs. */
const ERROR_CACHE_TTL_MS = Number(process.env.PWS_OBSERVATIONS_ERROR_CACHE_TTL_MS) || 300_000
/** Minimum time between 401 console.error lines (process-wide), even across stations. */
const LOG_401_INTERVAL_MS = Number(process.env.PWS_401_LOG_INTERVAL_MS) || 120_000

type NormalizedPws = { ts: number; condition: Partial<ICondition> }

type FetchResult =
	| { status: 200; data: NormalizedPws }
	| { status: 404; data: { error: string; stationId: string } }
	| { status: 502; data: { error: string; stationId: string; detail?: string } }

const CACHE_KEY_PREFIX = 'pws-current:'

function getStationCacheKey(stationId: string) {
	return `${CACHE_KEY_PREFIX}${stationId}`
}

type CachedEntry = { expiresAt: number; result: FetchResult }

const cacheMap = ((globalThis as any).__pwsObservationsCurrentCache ??= new Map<string, CachedEntry>()) as Map<
	string,
	CachedEntry
>
const inflightMap = ((globalThis as any).__pwsObservationsCurrentInflight ??= new Map<string, Promise<FetchResult>>())
let lastPws401LogAt = 0

interface PwsMetric {
	temp: number
	windSpeed: number
	windGust: number
	windChill?: number
	dewpt?: number
	pressure?: number
}

interface PwsObservation {
	stationID: string
	epoch: number
	winddir: number
	humidity: number
	metric: PwsMetric
}

interface PwsResponse {
	observations?: PwsObservation[]
}

function normalize(obs: PwsObservation): { ts: number; condition: Partial<ICondition> } {
	const m = obs.metric
	return {
		ts: obs.epoch,
		condition: {
			temp: m.temp,
			hum: obs.humidity,
			wind_dir_last: obs.winddir,
			wind_speed_last: m.windSpeed,
			wind_speed_avg_last_10_min: m.windSpeed,
			wind_speed_hi_last_10_min: m.windGust,
		},
	}
}

async function fetchFromWeatherCom(stationId: string, apiKey: string): Promise<FetchResult> {
	try {
		const url = `${PWS_URL}?apiKey=${encodeURIComponent(apiKey)}&stationId=${encodeURIComponent(stationId)}&format=json&units=m`
		const data = await $fetch<PwsResponse>(url)
		const obs = data?.observations?.[0]
		if (!obs) {
			return { status: 404, data: { error: 'No observation', stationId } }
		}
		return { status: 200, data: normalize(obs) }
	} catch (e: any) {
		const status = e?.statusCode ?? e?.status ?? e?.response?.status
		if (status === 401) {
			const t = Date.now()
			if (t - lastPws401LogAt >= LOG_401_INTERVAL_MS) {
				lastPws401LogAt = t
				console.error(
					'PWS fetch failed: 401 Unauthorized — WEATHER_COM_API_KEY missing, invalid, or expired (renew at developer.weather.com)',
				)
			}
			return {
				status: 502,
				data: {
					error: 'PWS API unavailable',
					stationId,
					detail: 'Unauthorized: set a valid WEATHER_COM_API_KEY',
				},
			}
		}
		console.error('PWS fetch failed:', e?.message || e)
		return { status: 502, data: { error: 'PWS API unavailable', stationId, detail: e?.message } }
	}
}

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	const apiKey = (config.weatherComApiKey as string)?.trim()
	if (!apiKey) {
		setResponseStatus(event, 500)
		return { error: 'WEATHER_COM_API_KEY not configured' }
	}

	const query = getQuery(event)
	const stationId = (query.stationId as string) || 'ISARNT29'
	const cacheKey = getStationCacheKey(stationId)
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

	// 3) Start one upstream request and let all concurrent users share it.
	const promise = fetchFromWeatherCom(stationId, apiKey)
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
