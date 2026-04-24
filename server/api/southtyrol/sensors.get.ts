/**
 * Proxy to South Tyrol Buergernetz sensors API.
 * Query: station_code (single) or station_codes (comma-separated).
 * Returns normalized object(s) compatible with frontend (same shape as WeatherLink condition).
 */

const SOUTH_TIROL_SENSORS_URL = 'http://daten.buergernetz.bz.it/services/meteo/v1/sensors'

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

	const results: Record<string, INormalizedSouthTyrolStation> = {}
	await Promise.all(codes.map(async (code) => {
		try {
			const url = `${SOUTH_TIROL_SENSORS_URL}?station_code=${encodeURIComponent(code)}`
			const rows = await $fetch<ISouthTyrolSensorRow[]>(url)
			if (Array.isArray(rows)) results[code] = normalizeSouthTyrolRows(rows)
		} catch (e) {
			console.error(`South Tyrol sensors fetch failed for ${code}:`, e)
			results[code] = { ts: 0 }
		}
	}))

	if (codes.length === 1) return results[codes[0]]
	return results
})
