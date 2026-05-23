import { diffPressureByTime, type HourlyPressure } from '../utils/foehn-pressure-diff'

const BOZEN_LAT = 46.4977
const BOZEN_LON = 11.3128
const INNSBRUCK_LAT = 47.2602
const INNSBRUCK_LON = 11.3441
const TZ = 'Europe/Vienna'
const FOEHN_SERIES_CACHE_TTL_MS = Number(process.env.FOEHN_SERIES_CACHE_TTL_MS) || 5 * 60 * 1000
const FOEHN_SERIES_ERROR_CACHE_TTL_MS = Number(process.env.FOEHN_SERIES_ERROR_CACHE_TTL_MS) || 15 * 60 * 1000
/** Gap between Open-Meteo calls to avoid burst 429s. */
const OPEN_METEO_GAP_MS = Number(process.env.OPEN_METEO_REQUEST_GAP_MS) || 400

type FoehnSeriesPayload = {
	generatedAt: string
	timezone: string
	pastHours: number
	forecastHours: number
	unit: string
	note: string
	sources: {
		openMeteo: {
			pastAnalysis: string
			combinedForecast: string
		}
	}
	rows: Array<{
		time: string
		observation: number | null
		pastForecast: number | null
		forecast: number | null
	}>
	error?: string
	stale?: boolean
}

const cache = ((globalThis as any).__foehnSeriesCache ??= {
	ts: 0,
	errorUntil: 0,
	payload: null as FoehnSeriesPayload | null,
})

let inflight: Promise<FoehnSeriesPayload> | null = null

function openMeteoHourlyUrl(
	lat: number,
	lon: number,
	pastHours: number,
	forecastHours: number
) {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'pressure_msl',
		timezone: TZ,
		past_hours: String(pastHours),
		forecast_hours: String(forecastHours),
		models: 'best_match',
	})
	return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(e: unknown): boolean {
	const err = e as { statusCode?: number; status?: number; response?: { status?: number } }
	const status = err?.statusCode ?? err?.status ?? err?.response?.status
	return status === 429
}

function numOrNull(v: unknown): number | null {
	if (v == null) return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

function stalePayload(message: string): FoehnSeriesPayload {
	return {
		...cache.payload!,
		stale: true,
		error: message,
	}
}

async function buildFoehnSeries(): Promise<FoehnSeriesPayload> {
	const pastHours = 24
	const forecastHours = 120
	const urlBozenPast = openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, pastHours, 0)
	const urlInnPast = openMeteoHourlyUrl(INNSBRUCK_LAT, INNSBRUCK_LON, pastHours, 0)
	const urlBozenCombo = openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, pastHours, forecastHours)
	const urlInnCombo = openMeteoHourlyUrl(INNSBRUCK_LAT, INNSBRUCK_LON, pastHours, forecastHours)

	let rateLimited = false

	async function fetchHourlyPressure(url: string): Promise<HourlyPressure> {
		try {
			return await $fetch<HourlyPressure>(url)
		} catch (e) {
			if (isRateLimitError(e)) rateLimited = true
			console.error('[foehn-series] Open-Meteo request failed:', url, e)
			return {}
		}
	}

	const bozenPast = await fetchHourlyPressure(urlBozenPast)
	await delay(OPEN_METEO_GAP_MS)
	const innPast = await fetchHourlyPressure(urlInnPast)
	await delay(OPEN_METEO_GAP_MS)
	const bozenCombo = await fetchHourlyPressure(urlBozenCombo)
	await delay(OPEN_METEO_GAP_MS)
	const innCombo = await fetchHourlyPressure(urlInnCombo)

	const obsMap = diffPressureByTime(bozenPast, innPast)
	const comboMap = diffPressureByTime(bozenCombo, innCombo)
	const comboTimes = [...comboMap.keys()].sort()
	const first24 = new Set(comboTimes.slice(0, pastHours))
	const last96 = new Set(comboTimes.slice(pastHours))

	const allTimes = new Set([...obsMap.keys(), ...comboMap.keys()])
	const sorted = [...allTimes].sort()

	const rows = sorted.map((time) => ({
		time: String(time),
		observation: numOrNull(obsMap.get(time)),
		pastForecast: first24.has(time) ? numOrNull(comboMap.get(time)) : null,
		forecast: last96.has(time) ? numOrNull(comboMap.get(time)) : null,
	}))

	const payload: FoehnSeriesPayload = {
		generatedAt: new Date().toISOString(),
		timezone: TZ,
		pastHours,
		forecastHours,
		unit: 'hPa',
		note: 'Beobachtung (rot): Open-Meteo Analyse der letzten 24 h. Violett und blau sind ein durchgehender best_match-Verlauf (24 h + 96 h in einem API-Lauf) – gleiche Vorhersage am Übergang, ohne Modellwechsel. Bei jedem Laden gilt der aktuelle Modellstand.',
		sources: {
			openMeteo: {
				pastAnalysis: urlBozenPast,
				combinedForecast: urlBozenCombo,
			},
		},
		rows,
	}

	if (rows.length === 0) {
		if (cache.payload) {
			throw new Error(
				rateLimited
					? 'Open-Meteo rate limited, serving cached data.'
					: 'Open-Meteo returned no rows, serving cached data.',
			)
		}
		if (rateLimited) {
			throw new Error('Open-Meteo rate limited.')
		}
	}

	return payload
}

export default defineEventHandler(async (event) => {
	const now = Date.now()

	if (cache.payload && cache.errorUntil > now) {
		return stalePayload('Open-Meteo rate limited, serving cached data.')
	}

	if (cache.payload && now - cache.ts < FOEHN_SERIES_CACHE_TTL_MS) {
		return cache.payload
	}

	if (inflight) {
		return inflight
	}

	inflight = (async () => {
		try {
			const payload = await buildFoehnSeries()
			cache.ts = now
			cache.errorUntil = 0
			cache.payload = payload
			return payload
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			const rateLimited = msg.includes('rate limit')
			if (rateLimited) {
				cache.errorUntil = now + FOEHN_SERIES_ERROR_CACHE_TTL_MS
			}
			if (cache.payload) {
				console.warn('[foehn-series]', msg)
				return stalePayload(msg)
			}
			console.error('[foehn-series] fatal:', e)
			setResponseStatus(event, 200)
			return {
				generatedAt: new Date().toISOString(),
				timezone: TZ,
				pastHours: 24,
				forecastHours: 120,
				unit: 'hPa',
				note: 'Daten konnten nicht berechnet werden.',
				sources: {
					openMeteo: {
						pastAnalysis: openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, 24, 0),
						combinedForecast: openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, 24, 120),
					},
				},
				rows: [],
				error: msg,
			}
		} finally {
			inflight = null
		}
	})()

	return inflight
})
