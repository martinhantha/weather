/**
 * Public WeatherLink summary for Pichlberg.
 * Used only when the local station (89.190.166.17) or the WeatherLink v2 API has no data.
 *
 * `value` is the station's native unit: °F and mph. Direction is degrees.
 * The embed is behind CloudFront and lastReceived moves about once a minute,
 * so this URL is fetched at most once per minute.
 */
import type { ICondition } from '~/types'

const DEFAULT_EMBED_URL =
	'https://www.weatherlink.com/embeddablePage/summaryData/bace478de69c48d49e01c02ec4dd2e40'

export const PICHLBERG_EMBED_MIN_INTERVAL_MS = 60_000

const NAME_TO_FIELD: Record<string, keyof ICondition> = {
	Temp: 'temp',
	Hum: 'hum',
	'Dew Point': 'dew_point',
	'Wet Bulb': 'wet_bulb',
	'Heat Index': 'heat_index',
	'Wind Chill': 'wind_chill',
	'THW Index': 'thw_index',
	'Wind Speed': 'wind_speed_last',
	'Wind Direction': 'wind_dir_last',
	'1 Min Avg Wind Speed': 'wind_speed_avg_last_1_min',
	'1 Min Scalar Avg Wind Direction': 'wind_dir_scalar_avg_last_1_min',
	'2 Min Avg Wind Speed': 'wind_speed_avg_last_2_min',
	'2 Min High Wind Speed': 'wind_speed_hi_last_2_min',
	'10 Min Avg Wind Speed': 'wind_speed_avg_last_10_min',
	'10 Min High Wind Speed': 'wind_speed_hi_last_10_min',
}

const FAHRENHEIT = new Set<keyof ICondition>([
	'temp',
	'dew_point',
	'wet_bulb',
	'heat_index',
	'wind_chill',
	'thw_index',
])

const MPH = new Set<keyof ICondition>([
	'wind_speed_last',
	'wind_speed_avg_last_1_min',
	'wind_speed_avg_last_2_min',
	'wind_speed_hi_last_2_min',
	'wind_speed_avg_last_10_min',
	'wind_speed_hi_last_10_min',
])

interface EmbedSensor {
	sensorDataName?: string
	value?: number
}

interface EmbedPayload {
	ownerName?: string
	lastReceived?: number
	currConditionValues?: EmbedSensor[]
}

type CacheEntry = { fetchedAt: number; payload: EmbedPayload | null }

const cache = ((globalThis as any).__pichlbergEmbedCache ??= { current: null as CacheEntry | null }) as {
	current: CacheEntry | null
}
let inflight: Promise<EmbedPayload | null> | null = null

function embedUrl(): string {
	return process.env.PICHBERG_EMBED_URL?.trim() || DEFAULT_EMBED_URL
}

function fahrenheitToCelsius(num: number): number {
	return parseFloat(((5 / 9) * (num - 32)).toFixed(1))
}

function mphToKmh(num: number): number {
	return Math.round(num * 1.609344)
}

function conditionFromPayload(payload: EmbedPayload, metric: boolean): Partial<ICondition> | null {
	const condition: Partial<ICondition> = {}
	let count = 0
	for (const sensor of payload.currConditionValues ?? []) {
		const field = sensor.sensorDataName ? NAME_TO_FIELD[sensor.sensorDataName] : undefined
		if (!field || typeof sensor.value !== 'number' || Number.isNaN(sensor.value)) continue
		if (metric && FAHRENHEIT.has(field)) {
			;(condition as Record<string, number>)[field] = fahrenheitToCelsius(sensor.value)
		} else if (metric && MPH.has(field)) {
			;(condition as Record<string, number>)[field] = mphToKmh(sensor.value)
		} else {
			;(condition as Record<string, number>)[field] = sensor.value
		}
		count++
	}
	return count > 0 ? condition : null
}

function timestampSeconds(payload: EmbedPayload): number {
	const raw = payload.lastReceived
	if (typeof raw !== 'number' || Number.isNaN(raw)) return Math.floor(Date.now() / 1000)
	return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw)
}

async function loadEmbed(): Promise<EmbedPayload | null> {
	const now = Date.now()
	if (cache.current && now - cache.current.fetchedAt < PICHLBERG_EMBED_MIN_INTERVAL_MS) {
		return cache.current.payload
	}
	if (inflight) return inflight

	inflight = (async () => {
		try {
			const payload = await $fetch<EmbedPayload>(embedUrl(), {
				timeout: 8_000,
				headers: { Accept: 'application/json' },
			})
			const ok = Array.isArray(payload?.currConditionValues) && payload.currConditionValues.length > 0
			cache.current = { fetchedAt: Date.now(), payload: ok ? payload : null }
			return ok ? payload : null
		} catch (error: unknown) {
			console.error('[pichlberg-embed] fetch failed:', (error as { message?: string })?.message ?? error)
			cache.current = { fetchedAt: Date.now(), payload: null }
			return null
		} finally {
			inflight = null
		}
	})()

	return inflight
}

/** Same shape as the local station JSON. Temperatures °F, wind mph, so the DB path converts them. */
export async function getPichlbergEmbedMeasurement(): Promise<{ data: { did: string; ts: number; conditions: Partial<ICondition>[] } } | null> {
	const payload = await loadEmbed()
	if (!payload) return null
	const condition = conditionFromPayload(payload, false)
	if (!condition) return null
	return {
		data: {
			did: 'pichlberg-embed',
			ts: timestampSeconds(payload),
			conditions: [condition],
		},
	}
}

/** Already °C and km/h, matching /api/weatherlink/current. */
export async function getPichlbergEmbedDisplay(): Promise<{ ts: number; condition: Partial<ICondition> } | null> {
	const payload = await loadEmbed()
	if (!payload) return null
	const condition = conditionFromPayload(payload, true)
	if (!condition) return null
	return { ts: timestampSeconds(payload), condition }
}
