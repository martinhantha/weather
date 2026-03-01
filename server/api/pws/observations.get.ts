/**
 * Proxy to Weather.com v2 PWS (Personal Weather Station) current observations.
 * Set WEATHER_COM_API_KEY in .env (key is valid until May, then renew at developer.weather.com).
 * Query: stationId (default ISARNT29). Returns normalized condition for wind list/gauges.
 */
import type { ICondition } from '~/types'

const PWS_URL = 'https://api.weather.com/v2/pws/observations/current'

interface PwsMetric {
	temp: number
	windSpeed: number
	windGust: number
	windChill?: number
	dewpt?: number
	pressure?: number
}

interface PwsObservation {
	stationID: string
	epoch: number
	winddir: number
	humidity: number
	metric: PwsMetric
}

interface PwsResponse {
	observations?: PwsObservation[]
}

function normalize(obs: PwsObservation): { ts: number; condition: Partial<ICondition> } {
	const m = obs.metric
	return {
		ts: obs.epoch,
		condition: {
			temp: m.temp,
			hum: obs.humidity,
			wind_dir_last: obs.winddir,
			wind_speed_last: m.windSpeed,
			wind_speed_avg_last_10_min: m.windSpeed,
			wind_speed_hi_last_10_min: m.windGust,
		},
	}
}

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	const apiKey = (config.weatherComApiKey as string)?.trim()
	if (!apiKey) {
		setResponseStatus(event, 500)
		return { error: 'WEATHER_COM_API_KEY not configured' }
	}

	const query = getQuery(event)
	const stationId = (query.stationId as string) || 'ISARNT29'

	try {
		const url = `${PWS_URL}?apiKey=${encodeURIComponent(apiKey)}&stationId=${encodeURIComponent(stationId)}&format=json&units=m`
		const data = await $fetch<PwsResponse>(url)
		const obs = data?.observations?.[0]
		if (!obs) {
			setResponseStatus(event, 404)
			return { error: 'No observation', stationId }
		}
		return normalize(obs)
	} catch (e: any) {
		console.error('PWS fetch failed:', e?.message || e)
		setResponseStatus(event, 502)
		return { error: 'PWS API unavailable', stationId, detail: e?.message }
	}
})
