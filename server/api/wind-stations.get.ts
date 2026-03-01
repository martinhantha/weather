/**
 * Returns WeatherLink station(s) data for the wind list.
 * Currently returns the single measurement from DB as Pichlberg (33570).
 * Can be extended to add Satteke (92575) when second station is available.
 */
import { Measurement } from '../models'
import type { ICondition } from '~/types'

function mphToKmh(num: number): number {
	return Math.round(Number(num) * 1.609344)
}
function fahrenheitToCelsius(num: number): number {
	return parseFloat(((5 / 9) * (num - 32)).toFixed(1))
}

export default defineEventHandler(async (event) => {
	const result = await Measurement.findOne(
		{ createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } },
		'json'
	)
    
	const out: Record<string, { station_id: string; ts: number; condition: Partial<ICondition> }> = {}

	if (result?.json?.data?.conditions?.[0]) {
		const c = result.json.data.conditions[0]
		const ts = result.json.data.ts
		const condition: Partial<ICondition> = {
			temp: c.temp != null ? fahrenheitToCelsius(c.temp) : undefined,
			wind_speed_last: c.wind_speed_last != null ? mphToKmh(c.wind_speed_last) : undefined,
			wind_speed_avg_last_10_min: c.wind_speed_avg_last_10_min != null ? mphToKmh(c.wind_speed_avg_last_10_min) : undefined,
			wind_speed_hi_last_10_min: c.wind_speed_hi_last_10_min != null ? mphToKmh(c.wind_speed_hi_last_10_min) : undefined,
			wind_dir_last: c.wind_dir_last,
			wind_dir_scalar_avg_last_10_min: c.wind_dir_scalar_avg_last_10_min,
			hum: c.hum,
			wet_bulb: c.wet_bulb != null ? fahrenheitToCelsius(c.wet_bulb) : undefined,
		}
		out['33570'] = { station_id: '33570', ts, condition }
        
	}
	return out
})
