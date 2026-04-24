/**
 * Fetch WeatherLink v2 current conditions for a station (e.g. 92575 Sattele).
 * Uses api-key query param + X-Api-Secret header (v2 auth). Fallback: legacy api-signature.
 */
import crypto from 'node:crypto'
import type { ICondition } from '~/types'

const WL_URL = 'https://api.weatherlink.com/v2/current'

function mphToKmh(num: number): number {
	return Math.round(Number(num) * 1.609344)
}
function fahrenheitToCelsius(num: number): number {
	return parseFloat(((5 / 9) * (num - 32)).toFixed(1))
}

function sign(apiSecret: string, params: Record<string, string>): string {
	const sorted = Object.keys(params).sort()
	const str = sorted.map((k) => k + params[k]).join('')
	return crypto.createHmac('sha256', apiSecret).update(str).digest('hex')
}

interface WlSensor {
	data_structure_type?: number
	data?: Array<Record<string, unknown>>
}

interface WlResponse {
	station_id: number
	sensors?: WlSensor[]
	generated_at?: number
}

function num(v: unknown): number | undefined {
	if (typeof v === 'number' && !Number.isNaN(v)) return v
	return undefined
}

/** Build condition from one sensor data row; returns null if no useful data. */
function conditionFromSensorData(d: Record<string, unknown>): { ts: number; condition: Partial<ICondition> } | null {
	if (!d || typeof d.ts !== 'number') return null
	const temp = num(d.temp) ?? num(d.temp_out)
	const hasAlternateWind = d.wind_speed != null || d.wind_speed_10_min_avg != null
	const wind = hasAlternateWind
		? (num(d.wind_speed) ?? num(d.wind_speed_last))
		: (num(d.wind_speed_last) ?? num(d.wind_speed))
	const wind10 = hasAlternateWind
		? (num(d.wind_speed_10_min_avg) ?? num(d.wind_speed_avg_last_10_min))
		: (num(d.wind_speed_avg_last_10_min) ?? num(d.wind_speed_10_min_avg))
	const windDir = num(d.wind_dir_last) ?? num(d.wind_dir)
	const windFromAlternate = hasAlternateWind
	const toKmh = (v: number) => (windFromAlternate ? Math.round(v) : mphToKmh(v))
	if (temp == null && wind == null && wind10 == null) return null
	const ts = d.ts as number
	const hiRaw = num(d.wind_speed_hi_last_10_min)
		?? num(d.wind_speed_10_min_hi)
		?? num((d as Record<string, unknown>).wind_gust)
	// Keep "10' max" strictly tied to gust/high fields.
	// If provider does not send a gust/high value, expose undefined instead of mirroring current/avg.
	const hiVal = hiRaw != null ? toKmh(hiRaw) : undefined
    
	const currentVal = wind != null ? toKmh(wind) : (wind10 != null ? toKmh(wind10) : hiVal)
	const avg10Val = wind10 != null ? toKmh(wind10) : (wind != null ? toKmh(wind) : hiVal)
	const condition: Partial<ICondition> = {
		temp: temp != null ? fahrenheitToCelsius(temp) : undefined,
		hum: num(d.hum) ?? num(d.hum_in) ?? num(d.hum_out),
		wind_dir_last: windDir,
		wind_dir_scalar_avg_last_10_min: num(d.wind_dir_scalar_avg_last_10_min) ?? windDir,
		wind_speed_last: currentVal,
		wind_speed_avg_last_10_min: avg10Val,
		wind_speed_hi_last_10_min: hiVal,
		wet_bulb: num(d.wet_bulb) != null ? fahrenheitToCelsius(num(d.wet_bulb)!) : undefined,
	}
	return { ts, condition }
}

/** Pick first condition, then merge wind from any other sensor (e.g. Pichlberg 33570 has separate wind sensor). */
function pickFirstCondition(sensors: WlSensor[]): { ts: number; condition: Partial<ICondition> } | null {
	const list: { ts: number; condition: Partial<ICondition> }[] = []
	for (const s of sensors || []) {
		const d = s.data?.[0]
		if (!d || typeof d !== 'object') continue
		const one = conditionFromSensorData(d as Record<string, unknown>)
		if (one) list.push(one)
	}
	const base = list[0]
	if (!base) return null
	const merged = { ...base.condition }
	for (let i = 1; i < list.length; i++) {
		const c = list[i]?.condition
		if (!c) continue
		if (c.wind_speed_last != null || c.wind_speed_avg_last_10_min != null || c.wind_speed_hi_last_10_min != null) {
			if (c.wind_speed_last != null) merged.wind_speed_last = c.wind_speed_last
			if (c.wind_speed_avg_last_10_min != null) merged.wind_speed_avg_last_10_min = c.wind_speed_avg_last_10_min
			if (c.wind_speed_hi_last_10_min != null) merged.wind_speed_hi_last_10_min = c.wind_speed_hi_last_10_min
			if (c.wind_dir_last != null) merged.wind_dir_last = c.wind_dir_last
			if (c.wind_dir_scalar_avg_last_10_min != null) merged.wind_dir_scalar_avg_last_10_min = c.wind_dir_scalar_avg_last_10_min
		}
	}
	return { ts: base.ts, condition: merged }
}

function dbg(payload: Record<string, unknown>) {
	// #region agent log
	// #endregion
}

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	const apiKey = (config.weatherlinkApiKey as string)?.trim()
	const apiSecret = (config.weatherlinkApiSecret as string)?.trim()

	// #region agent log
	dbg({
		location: 'weatherlink/current.get.ts:entry',
		message: 'Sattele handler entry',
		data: { stationId: (getQuery(event).stationId as string) || '92575', hasApiKey: !!apiKey, hasApiSecret: !!apiSecret },
		hypothesisId: 'H5',
	})
	// #endregion

	if (!apiKey || !apiSecret) {
		setResponseStatus(event, 500)
		return { error: 'WeatherLink API credentials not configured' }
	}

	const query = getQuery(event)
	const stationId = (query.stationId as string) || '92575'

	// Prefer v2 auth: api-key in query + X-Api-Secret header
	const url = `${WL_URL}/${stationId}?api-key=${encodeURIComponent(apiKey)}`

	try {
		let data: WlResponse
		let authUsed = 'header'
		try {
			data = await $fetch<WlResponse>(url, {
				headers: {
					'X-Api-Secret': apiSecret,
				},
			})
            // if(stationId === '92575') {
            //     console.log(JSON.stringify(data, null, 2));
            // }
			// #region agent log
			dbg({
				location: 'weatherlink/current.get.ts:header_ok',
				message: 'Header auth succeeded',
				data: { stationId, sensorCount: data?.sensors?.length ?? 0 },
				hypothesisId: 'H1',
			})
			// #endregion
		} catch (authErr: any) {
			// #region agent log
			dbg({
				location: 'weatherlink/current.get.ts:header_failed',
				message: 'Header auth failed, trying legacy',
				data: {
					stationId,
					statusCode: authErr?.statusCode ?? authErr?.status,
					message: authErr?.message,
				},
				hypothesisId: 'H1',
			})
			// #endregion
			// Fallback: legacy signature auth (PHP-style)
			authUsed = 'legacy'
			const t = Math.floor(Date.now() / 1000)
			const params: Record<string, string> = {
				'api-key': apiKey,
				'station-id': stationId,
				t: String(t),
			}
			const apiSignature = sign(apiSecret, params)
			const urlLegacy = `${WL_URL}/${stationId}?api-key=${encodeURIComponent(apiKey)}&api-signature=${apiSignature}&t=${t}`
			data = await $fetch<WlResponse>(urlLegacy)
			// #region agent log
			dbg({
				location: 'weatherlink/current.get.ts:legacy_ok',
				message: 'Legacy auth succeeded',
				data: { stationId, sensorCount: data?.sensors?.length ?? 0 },
				hypothesisId: 'H4',
			})
			// #endregion
		}
		const sensors = data?.sensors || []
		const result = pickFirstCondition(sensors)
		const firstData = sensors[0]?.data?.[0] as Record<string, unknown> | undefined
		const firstDataKeys = firstData ? Object.keys(firstData).slice(0, 15) : []
		// #region agent log
		dbg({
			location: 'weatherlink/current.get.ts:pick',
			message: 'pickFirstCondition result',
			data: {
				stationId,
				authUsed,
				sensorCount: sensors.length,
				pickFound: !!result,
				firstDataKeys,
			},
			hypothesisId: 'H2',
		})
		// #endregion
		if (!result) {
			setResponseStatus(event, 404)
			return { error: 'No current conditions', stationId }
		}
		return result
	} catch (e: any) {
		// #region agent log
		dbg({
			location: 'weatherlink/current.get.ts:catch',
			message: 'WeatherLink final error',
			data: {
				stationId,
				message: e?.message,
				statusCode: e?.statusCode ?? e?.status,
			},
			hypothesisId: 'H1',
		})
		// #endregion
		console.error('WeatherLink fetch failed:', e?.message || e)
		setResponseStatus(event, 502)
		return { error: 'WeatherLink API unavailable', stationId, detail: e?.data?.message || e?.message }
	}
})
