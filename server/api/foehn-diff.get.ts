import { diffPressureByTime, type HourlyPressure } from '../utils/foehn-pressure-diff'

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


export default defineEventHandler(async () => {
	const bolzanoUrl =
		'https://weather.services.siag.it/api/v2/station?categoryId=1&visibility=3'
	const omBozenUrl = openMeteoCurrentUrl(BOZEN_LAT, BOZEN_LON)
	const omInnsbruckUrl = openMeteoCurrentUrl(INNSBRUCK_LAT, INNSBRUCK_LON)
	const omBozenFc1Url = openMeteoFirstForecastHourUrl(BOZEN_LAT, BOZEN_LON)
	const omInnFc1Url = openMeteoFirstForecastHourUrl(INNSBRUCK_LAT, INNSBRUCK_LON)

	try {
		const [bolzanoRes, omBozen, omInnsbruck, omBozenFc1, omInnFc1] = await Promise.all([
			$fetch<{ rows?: any[] }>(bolzanoUrl, {
				headers: { accept: 'application/json' },
			}).catch((e) => {
				console.error('[foehn-diff] SIAG failed:', e)
				return {} as { rows?: any[] }
			}),
			$fetch<OpenMeteoCurrentResponse>(omBozenUrl).catch((e) => {
				console.error('[foehn-diff] Open-Meteo failed:', omBozenUrl, e)
				return {} as OpenMeteoCurrentResponse
			}),
			$fetch<OpenMeteoCurrentResponse>(omInnsbruckUrl).catch((e) => {
				console.error('[foehn-diff] Open-Meteo failed:', omInnsbruckUrl, e)
				return {} as OpenMeteoCurrentResponse
			}),
			$fetch<HourlyPressure>(omBozenFc1Url).catch((e) => {
				console.error('[foehn-diff] Open-Meteo failed:', omBozenFc1Url, e)
				return {} as HourlyPressure
			}),
			$fetch<HourlyPressure>(omInnFc1Url).catch((e) => {
				console.error('[foehn-diff] Open-Meteo failed:', omInnFc1Url, e)
				return {} as HourlyPressure
			}),
		])

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

		const omInnsbruckMsl = omInnsbruck.current?.pressure_msl
		const innsbruckPressure =
			omInnsbruckMsl != null && Number.isFinite(Number(omInnsbruckMsl))
				? Number(Number(omInnsbruckMsl).toFixed(1))
				: null
		const innsbruckMeasuredAt = omInnsbruck.current?.time ?? null

		const differenceStation =
			bolzanoPressure != null && innsbruckPressure != null
				? Number((bolzanoPressure - innsbruckPressure).toFixed(1))
				: null

		const fcMap = diffPressureByTime(omBozenFc1, omInnFc1)
		const fcKeys = [...fcMap.keys()].sort()
		const firstKey = fcKeys[0]
		const differenceModel = firstKey != null ? (fcMap.get(firstKey) ?? null) : null

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
					url: omInnsbruckUrl,
					measuredAt: innsbruckMeasuredAt,
				},
				modelForecastHour: {
					bozen: omBozenFc1Url,
					innsbruck: omInnFc1Url,
				},
			},
			bolzanoStation,
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e)
		console.error('[foehn-diff] fatal:', e)
		return {
			generatedAt: new Date().toISOString(),
			bolzanoPressure: null,
			innsbruckPressure: null,
			differenceStation: null,
			differenceModel: null,
			interpretation: null,
			sources: {
				bolzano: { url: bolzanoUrl, measuredAt: null },
				innsbruck: { url: omInnsbruckUrl, measuredAt: null },
				modelForecastHour: {
					bozen: omBozenFc1Url,
					innsbruck: omInnFc1Url,
				},
			},
			bolzanoStation: null,
			error: msg,
		}
	}
})
