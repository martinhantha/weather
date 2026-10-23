import { diffPressureByTime, type HourlyPressure } from '../utils/foehn-pressure-diff'
import { fetchInnsbruckMeasuredCurrent, innsbruckCurrentUrl } from '../utils/foehn-measured-pressure'

type OpenMeteoCurrentResponse = {
	current?: {
		time: string
		pressure_msl?: number
	}
}

const BOZEN_LAT = 46.4977
const BOZEN_LON = 11.3128
const INNSBRUCK_LAT = 47.2602
const INNSBRUCK_LON = 11.3441
const OM_TZ = 'Europe/Vienna'
const FOEHN_DIFF_CACHE_TTL_MS = Number(process.env.FOEHN_DIFF_CACHE_TTL_MS) || 5 * 60 * 1000
const FOEHN_DIFF_ERROR_CACHE_TTL_MS = Number(process.env.FOEHN_DIFF_ERROR_CACHE_TTL_MS) || 15 * 60 * 1000
const OPEN_METEO_GAP_MS = Number(process.env.OPEN_METEO_REQUEST_GAP_MS) || 400

type FoehnDiffPayload = {
	generatedAt: string
	bolzanoPressure: number | null
	innsbruckPressure: number | null
	differenceStation: number | null
	differenceModel: number | null
	interpretation: string | null
	sources: {
		bolzano: { url: string; measuredAt: string | null }
		innsbruck: { url: string; measuredAt: string | null }
		modelForecastHour: { bozen: string; innsbruck: string }
	}
	bolzanoStation: Record<string, unknown> | null
	error?: string
	stale?: boolean
}

const cache = ((globalThis as any).__foehnDiffCache ??= {
	ts: 0,
	errorUntil: 0,
	payload: null as FoehnDiffPayload | null,
})

let inflight: Promise<FoehnDiffPayload> | null = null

function openMeteoCurrentUrl(lat: number, lon: number) {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		current: 'pressure_msl',
		timezone: OM_TZ,
	})
	return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

function openMeteoFirstForecastHourUrl(lat: number, lon: number) {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'pressure_msl',
		timezone: OM_TZ,
		past_hours: '0',
		forecast_hours: '1',
		models: 'best_match',
	})
	return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

function matchesBozenStation(row: { name?: unknown; code?: unknown }) {
	const name = String(row.name || '').toLowerCase()
	if (name.includes('bozen') || name.includes('bolzano')) return true
	const code = String(row.code || '').toLowerCase()
	return code.includes('83200')
}

function interpretationFor(delta: number | null) {
	if (delta == null) return null
	if (delta < 0) return 'Nordföhn wahrscheinlich'
	if (delta > 0) return 'Südföhn / Gegenrichtung'
	return 'neutral'
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(e: unknown): boolean {
	const err = e as { statusCode?: number; status?: number; response?: { status?: number } }
	const status = err?.statusCode ?? err?.status ?? err?.response?.status
	return status === 429
}

function stalePayload(message: string): FoehnDiffPayload {
	return {
		...cache.payload!,
		stale: true,
		error: message,
	}
}

async function buildFoehnDiff(): Promise<FoehnDiffPayload> {
	const bolzanoUrl =
		'https://weather.services.siag.it/api/v2/station?categoryId=1&visibility=3'
	const omBozenUrl = openMeteoCurrentUrl(BOZEN_LAT, BOZEN_LON)
	const omInnsbruckUrl = openMeteoCurrentUrl(INNSBRUCK_LAT, INNSBRUCK_LON)
	const omBozenFc1Url = openMeteoFirstForecastHourUrl(BOZEN_LAT, BOZEN_LON)
	const omInnFc1Url = openMeteoFirstForecastHourUrl(INNSBRUCK_LAT, INNSBRUCK_LON)

	let rateLimited = false

	async function fetchOpenMeteo<T>(url: string, label: string): Promise<T> {
		try {
			return await $fetch<T>(url)
		} catch (e) {
			if (isRateLimitError(e)) rateLimited = true
			console.error(`[foehn-diff] Open-Meteo failed (${label}):`, url, e)
			return {} as T
		}
	}

	const [bolzanoRes, innsbruckMeasured] = await Promise.all([
		$fetch<{ rows?: any[] }>(bolzanoUrl, {
			headers: { accept: 'application/json' },
		}).catch((e) => {
			console.error('[foehn-diff] SIAG failed:', e)
			return {} as { rows?: any[] }
		}),
		fetchInnsbruckMeasuredCurrent().catch((e) => {
			console.error('[foehn-diff] GeoSphere failed:', e)
			return null
		}),
	])

	const omBozen = await fetchOpenMeteo<OpenMeteoCurrentResponse>(omBozenUrl, 'bozen-current')
	await delay(OPEN_METEO_GAP_MS)
	const omInnsbruck = await fetchOpenMeteo<OpenMeteoCurrentResponse>(omInnsbruckUrl, 'innsbruck-current')
	await delay(OPEN_METEO_GAP_MS)
	const omBozenFc1 = await fetchOpenMeteo<HourlyPressure>(omBozenFc1Url, 'bozen-fc1')
	await delay(OPEN_METEO_GAP_MS)
	const omInnFc1 = await fetchOpenMeteo<HourlyPressure>(omInnFc1Url, 'innsbruck-fc1')

	const rows = Array.isArray(bolzanoRes?.rows) ? bolzanoRes.rows : []
	const bolzanoStation = rows.find((row) => matchesBozenStation(row)) ?? null

	const siagP = bolzanoStation?.p != null ? Number(bolzanoStation.p) : null
	const siagPValid = siagP != null && Number.isFinite(siagP)

	const omBozenMsl = omBozen.current?.pressure_msl
	const omBozenValid = omBozenMsl != null && Number.isFinite(Number(omBozenMsl))

	const bolzanoPressure = siagPValid
		? Number(siagP.toFixed(1))
		: omBozenValid
			? Number(Number(omBozenMsl).toFixed(1))
			: null

	const bolzanoMeasuredAt = siagPValid
		? (bolzanoStation?.lastUpdated ?? null)
		: omBozenValid
			? (omBozen.current?.time ?? null)
			: null

	// Innsbruck: measured station value (GeoSphere), Open-Meteo model only as fallback
	const omInnsbruckMsl = omInnsbruck.current?.pressure_msl
	const omInnsbruckValid = omInnsbruckMsl != null && Number.isFinite(Number(omInnsbruckMsl))
	const innsbruckPressure = innsbruckMeasured
		? Number(innsbruckMeasured.pressure.toFixed(1))
		: omInnsbruckValid
			? Number(Number(omInnsbruckMsl).toFixed(1))
			: null
	const innsbruckMeasuredAt = innsbruckMeasured
		? innsbruckMeasured.measuredAt
		: omInnsbruckValid
			? (omInnsbruck.current?.time ?? null)
			: null

	const differenceStation =
		bolzanoPressure != null && innsbruckPressure != null
			? Number((bolzanoPressure - innsbruckPressure).toFixed(1))
			: null

	const fcMap = diffPressureByTime(omBozenFc1, omInnFc1)
	const fcKeys = [...fcMap.keys()].sort()
	const firstKey = fcKeys[0]
	const differenceModel = firstKey != null ? (fcMap.get(firstKey) ?? null) : null

	if (rateLimited && differenceStation == null && differenceModel == null) {
		throw new Error('Open-Meteo rate limited.')
	}

	return {
		generatedAt: new Date().toISOString(),
		bolzanoPressure,
		innsbruckPressure,
		differenceStation,
		differenceModel,
		interpretation: interpretationFor(differenceStation ?? differenceModel),
		sources: {
			bolzano: {
				url: siagPValid ? bolzanoUrl : omBozenUrl,
				measuredAt: bolzanoMeasuredAt,
			},
			innsbruck: {
				url: innsbruckMeasured ? innsbruckCurrentUrl() : omInnsbruckUrl,
				measuredAt: innsbruckMeasuredAt,
			},
			modelForecastHour: {
				bozen: omBozenFc1Url,
				innsbruck: omInnFc1Url,
			},
		},
		bolzanoStation,
	}
}

export default defineEventHandler(async () => {
	const now = Date.now()

	if (cache.payload && cache.errorUntil > now) {
		return stalePayload('Open-Meteo rate limited, serving cached data.')
	}

	if (cache.payload && now - cache.ts < FOEHN_DIFF_CACHE_TTL_MS) {
		return cache.payload
	}

	if (inflight) {
		return inflight
	}

	inflight = (async () => {
		try {
			const payload = await buildFoehnDiff()
			cache.ts = now
			cache.errorUntil = 0
			cache.payload = payload
			return payload
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			const rateLimited = msg.includes('rate limit')
			if (rateLimited) {
				cache.errorUntil = now + FOEHN_DIFF_ERROR_CACHE_TTL_MS
			}
			if (cache.payload) {
				console.warn('[foehn-diff]', msg)
				return stalePayload(msg)
			}
			console.error('[foehn-diff] fatal:', e)
			return {
				generatedAt: new Date().toISOString(),
				bolzanoPressure: null,
				innsbruckPressure: null,
				differenceStation: null,
				differenceModel: null,
				interpretation: null,
				sources: {
					bolzano: {
						url: 'https://weather.services.siag.it/api/v2/station?categoryId=1&visibility=3',
						measuredAt: null,
					},
					innsbruck: {
						url: innsbruckCurrentUrl(),
						measuredAt: null,
					},
					modelForecastHour: {
						bozen: openMeteoFirstForecastHourUrl(BOZEN_LAT, BOZEN_LON),
						innsbruck: openMeteoFirstForecastHourUrl(INNSBRUCK_LAT, INNSBRUCK_LON),
					},
				},
				bolzanoStation: null,
				error: msg,
			}
		} finally {
			inflight = null
		}
	})()

	return inflight
})
