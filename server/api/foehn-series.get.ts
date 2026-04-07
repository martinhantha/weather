import { diffPressureByTime, type HourlyPressure } from '../utils/foehn-pressure-diff'

const BOZEN_LAT = 46.4977
const BOZEN_LON = 11.3128
const INNSBRUCK_LAT = 47.2602
const INNSBRUCK_LON = 11.3441
const TZ = 'Europe/Vienna'
const FOEHN_SERIES_CACHE_TTL_MS = 5 * 60 * 1000

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
	payload: null as FoehnSeriesPayload | null,
})

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

async function fetchHourlyPressure(url: string): Promise<HourlyPressure> {
	try {
		return await $fetch<HourlyPressure>(url)
	} catch (e) {
		console.error('[foehn-series] Open-Meteo request failed:', url, e)
		return {}
	}
}

function numOrNull(v: unknown): number | null {
	if (v == null) return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

export default defineEventHandler(async (event) => {
	const pastHours = 24
	const forecastHours = 120
	const now = Date.now()

	if (cache.payload && now - cache.ts < FOEHN_SERIES_CACHE_TTL_MS) {
		return cache.payload
	}

	const urlBozenPast = openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, pastHours, 0)
	const urlInnPast = openMeteoHourlyUrl(INNSBRUCK_LAT, INNSBRUCK_LON, pastHours, 0)
	const urlBozenCombo = openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, pastHours, forecastHours)
	const urlInnCombo = openMeteoHourlyUrl(INNSBRUCK_LAT, INNSBRUCK_LON, pastHours, forecastHours)

	try {
		const [bozenPast, innPast, bozenCombo, innCombo] = await Promise.all([
			fetchHourlyPressure(urlBozenPast),
			fetchHourlyPressure(urlInnPast),
			fetchHourlyPressure(urlBozenCombo),
			fetchHourlyPressure(urlInnCombo),
		])

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

		// Open-Meteo can temporarily 429; keep serving the last good series.
		if (rows.length === 0 && cache.payload) {
			return {
				...cache.payload,
				stale: true,
				error: 'Open-Meteo rate limited, serving cached data.',
			}
		}

		cache.ts = now
		cache.payload = payload
		JSON.stringify(payload)
		return payload
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e)
		console.error('[foehn-series] fatal:', e)
		if (cache.payload) {
			return {
				...cache.payload,
				stale: true,
				error: msg,
			}
		}
		setResponseStatus(event, 200)
		return {
			generatedAt: new Date().toISOString(),
			timezone: TZ,
			pastHours,
			forecastHours,
			unit: 'hPa',
			note: 'Daten konnten nicht berechnet werden.',
			sources: {
				openMeteo: {
					pastAnalysis: urlBozenPast,
					combinedForecast: urlBozenCombo,
				},
			},
			rows: [] as {
				time: string
				observation: number | null
				pastForecast: number | null
				forecast: number | null
			}[],
			error: msg,
		}
	}
})
