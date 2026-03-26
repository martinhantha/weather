/**
 * Proxy to Weathercloud device values.
 *
 * Query: deviceId (default: 9123924154).
 * Returns normalized object compatible with frontend (same shape as WeatherLink condition).
 */
import { getWeather } from 'weathercloud-js'
import type { ICondition } from '~/types'

function mpsToKmh(num: number): number {
	// weathercloud-js treats `wspd` as m/s (see chillFn uses `wspd * 3.6`)
	return Math.round(num * 3.6)
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const deviceId = ((query.deviceId as string | undefined) ?? '9123924154').trim()

	try {
		const res = await getWeather(deviceId as any)
		if (!res || typeof res !== 'object' || 'error' in res) {
			setResponseStatus(event, 502)
			return { error: 'Weathercloud API unavailable', deviceId, detail: (res as any)?.error ?? res }
		}

		// weathercloud-js returns epoch and a set of value fields.
		const epoch = (res as any).epoch
		if (typeof epoch !== 'number') {
			setResponseStatus(event, 502)
			return { error: 'Weathercloud invalid response (missing epoch)', deviceId }
		}

		const condition: Partial<ICondition> = {
			temp: typeof (res as any).temp === 'number' ? (res as any).temp : undefined,
			hum: typeof (res as any).hum === 'number' ? (res as any).hum : undefined,
			// weathercloud device values are in m/s; convert to km/h to match other providers.
			wind_speed_last: typeof (res as any).wspd === 'number' ? mpsToKmh((res as any).wspd) : undefined,
			wind_speed_hi_last_10_min: typeof (res as any).wspdhi === 'number' ? mpsToKmh((res as any).wspdhi) : undefined,
			wind_speed_avg_last_10_min: typeof (res as any).wspdavg === 'number' ? mpsToKmh((res as any).wspdavg) : undefined,
			wind_dir_last: typeof (res as any).wdir === 'number' ? (res as any).wdir : undefined,
			// Weathercloud exposes an averaged wind direction; use it for the "scalar" arrow.
			wind_dir_scalar_avg_last_10_min: typeof (res as any).wdiravg === 'number' ? (res as any).wdiravg : undefined,
		}

		return { ts: epoch, condition }
	} catch (e: any) {
		setResponseStatus(event, 502)
		return {
			error: 'Weathercloud API unavailable',
			deviceId,
			detail: e?.message || e,
		}
	}
})

