/**
 * Returns WeatherLink station(s) data for the wind list.
 * Reads from DB (Pichlberg 33570) via URI/mongoose or Data API. When DB is empty or not configured,
 * falls back to the canonical API and WeatherLink.
 */
import * as db from '../utils/db'
import type { ICondition } from '~/types'

function mphToKmh(num: number): number {
	return Math.round(Number(num) * 1.609344)
}
function fahrenheitToCelsius(num: number): number {
	return parseFloat(((5 / 9) * (num - 32)).toFixed(1))
}

type WindStationsOut = Record<string, { station_id: string; ts: number; condition: Partial<ICondition> }>

export default defineEventHandler(async (event): Promise<WindStationsOut> => {
	const out: WindStationsOut = {}

	if (db.isConfigured(event)) {
		try {
			const doc = await db.findOne(event, {}, { _id: -1 as const })
			if (doc?.json && typeof doc.json === 'object') {
				const data = (doc.json as { data?: { conditions?: Array<Record<string, unknown>>; ts?: number } }).data
				const c = data?.conditions?.[0]
				const ts = data?.ts
				if (c && ts != null) {
					const condition: Partial<ICondition> = {
						temp: c.temp != null ? fahrenheitToCelsius(Number(c.temp)) : undefined,
						wind_speed_last: c.wind_speed_last != null ? mphToKmh(Number(c.wind_speed_last)) : undefined,
						wind_speed_avg_last_10_min: c.wind_speed_avg_last_10_min != null ? mphToKmh(Number(c.wind_speed_avg_last_10_min)) : undefined,
						wind_speed_hi_last_10_min: c.wind_speed_hi_last_10_min != null ? mphToKmh(Number(c.wind_speed_hi_last_10_min)) : undefined,
						wind_dir_last: typeof c.wind_dir_last === 'number' ? c.wind_dir_last : undefined,
						wind_dir_scalar_avg_last_10_min: typeof c.wind_dir_scalar_avg_last_10_min === 'number' ? c.wind_dir_scalar_avg_last_10_min : undefined,
						hum: typeof c.hum === 'number' ? c.hum : undefined,
						wet_bulb: c.wet_bulb != null ? fahrenheitToCelsius(Number(c.wet_bulb)) : undefined,
					}
					out['33570'] = { station_id: '33570', ts, condition }
					return out
				}
			}
		} catch (_) {
			// ignore
		}
	}

	// No DB data: try canonical API, then WeatherLink for Pichlberg
	const config = useRuntimeConfig()
	const apiUrl = (config.public?.apiUrl as string)?.trim()
	if (apiUrl) {
		try {
			const fallback = await $fetch<WindStationsOut>(`${apiUrl.replace(/\/$/, '')}/api/wind-stations`, {
				headers: { Accept: 'application/json' },
			})
			if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
				return fallback
			}
		} catch (_) {
			// ignore
		}
	}

	try {
		const base = getRequestURL(event).origin
		const wl = await $fetch<{ ts?: number; condition?: Partial<ICondition>; error?: string }>(
			`${base}/api/weatherlink/current?stationId=33570`,
			{ headers: { Accept: 'application/json' } }
		)
		if (wl?.ts != null && wl?.condition && typeof wl.condition === 'object') {
			out['33570'] = { station_id: '33570', ts: wl.ts, condition: wl.condition }
		}
	} catch (_) {
		// ignore
	}

	return out
})
