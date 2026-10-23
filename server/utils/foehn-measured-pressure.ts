import type { HourlyPressure } from './foehn-pressure-diff'

/** Bozen: Landeswetterdienst Südtirol, reduced pressure (LD.RED), 10-min values. */
export const SIAG_TIMESERIES_URL = 'https://geoservices.buergernetz.bz.it/services/meteo/v1/timeseries'
export const BOZEN_STATION_CODE = '83200MS'
/** Innsbruck Flughafen: GeoSphere Austria TAWES, reduced pressure (PRED), 10-min values. */
export const GEOSPHERE_STATION_URL = 'https://dataset.api.hub.geosphere.at/v1/station'
export const INNSBRUCK_TAWES_ID = '11320'

const TZ = 'Europe/Vienna'
const REQUEST_TIMEOUT_MS = 10_000

type GeoSphereResponse = {
	timestamps?: string[]
	features?: Array<{ properties?: { parameters?: { PRED?: { data?: (number | null)[] } } } }>
}

/** 'YYYY-MM-DDTHH:mm' in Vienna local time, the same format Open-Meteo uses for hourly times. */
function viennaLocal(date: Date): string {
	return new Intl.DateTimeFormat('sv-SE', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	})
		.format(date)
		.replace(' ', 'T')
}

/** Keeps only the full-hour samples so they line up with the Open-Meteo forecast hours. */
function toHourly(entries: Array<[string, unknown]>): HourlyPressure {
	const time: string[] = []
	const pressure_msl: number[] = []
	for (const [t, v] of entries) {
		const n = Number(v)
		if (!t.endsWith(':00') || v == null || !Number.isFinite(n)) continue
		time.push(t)
		pressure_msl.push(n)
	}
	return { hourly: { time, pressure_msl } }
}

export function bozenTimeseriesUrl(hours: number): string {
	const from = viennaLocal(new Date(Date.now() - hours * 3600_000)).replace(/\D/g, '')
	const params = new URLSearchParams({ station_code: BOZEN_STATION_CODE, sensor_code: 'LD.RED', date_from: from })
	return `${SIAG_TIMESERIES_URL}?${params.toString()}`
}

export function innsbruckHistoryUrl(hours: number): string {
	const end = new Date()
	const start = new Date(end.getTime() - hours * 3600_000)
	const params = new URLSearchParams({
		parameters: 'PRED',
		station_ids: INNSBRUCK_TAWES_ID,
		start: start.toISOString().slice(0, 16),
		end: end.toISOString().slice(0, 16),
	})
	return `${GEOSPHERE_STATION_URL}/historical/tawes-v1-10min?${params.toString()}`
}

export function innsbruckCurrentUrl(): string {
	const params = new URLSearchParams({ parameters: 'PRED', station_ids: INNSBRUCK_TAWES_ID })
	return `${GEOSPHERE_STATION_URL}/current/tawes-v1-10min?${params.toString()}`
}

/** Measured hourly pressure in Bozen for the last `hours` hours. */
export async function fetchBozenMeasuredHourly(hours: number): Promise<HourlyPressure> {
	const rows = await $fetch<Array<{ DATE?: string; VALUE?: unknown }>>(bozenTimeseriesUrl(hours), {
		timeout: REQUEST_TIMEOUT_MS,
	})
	// DATE is local time with zone suffix, e.g. "2026-10-23T15:20:00CEST"
	return toHourly((Array.isArray(rows) ? rows : []).map((r) => [String(r.DATE ?? '').slice(0, 16), r.VALUE]))
}

/** Measured hourly pressure at Innsbruck Flughafen for the last `hours` hours. */
export async function fetchInnsbruckMeasuredHourly(hours: number): Promise<HourlyPressure> {
	const res = await $fetch<GeoSphereResponse>(innsbruckHistoryUrl(hours), { timeout: REQUEST_TIMEOUT_MS })
	const data = res.features?.[0]?.properties?.parameters?.PRED?.data ?? []
	return toHourly((res.timestamps ?? []).map((ts, i) => [viennaLocal(new Date(ts)), data[i]]))
}

/** Latest 10-min pressure reading at Innsbruck Flughafen. */
export async function fetchInnsbruckMeasuredCurrent(): Promise<{ pressure: number; measuredAt: string } | null> {
	const res = await $fetch<GeoSphereResponse>(innsbruckCurrentUrl(), { timeout: REQUEST_TIMEOUT_MS })
	const value = Number(res.features?.[0]?.properties?.parameters?.PRED?.data?.[0])
	const ts = res.timestamps?.[0]
	if (!ts || !Number.isFinite(value)) return null
	return { pressure: value, measuredAt: new Date(ts).toISOString() }
}
