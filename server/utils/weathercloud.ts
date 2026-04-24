/**
 * Minimal Weathercloud "values" fetch (same URLs/POST shape as weathercloud-js).
 * Kept in-repo so CI/build does not depend on resolving the npm package.
 */

export function weathercloudIdType(id: string): 'device' | 'metar' | null {
	if (/^[0-9]{9,10}$/.test(id)) return 'device'
	if (/^[A-Z]{4}$/.test(id)) return 'metar'
	return null
}

/** Same contract as weathercloud-js `getWeather`: device object, or `{ error }`. */
export async function fetchWeathercloudValues(id: string): Promise<Record<string, unknown> | { error: unknown }> {
	const type = weathercloudIdType(id)
	if (!type) {
		return { error: new Error('Invalid ID') }
	}
	const url = `https://app.weathercloud.net/${type}/values?code=${encodeURIComponent(id)}`
	try {
		const resp = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'X-Requested-With': 'XMLHttpRequest',
			},
			body: '',
		})
		console.log(resp)
		const data = await resp.json()
		if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error === true) {
			return { error: (data as { err?: unknown }).err ?? data }
		}
		if (!data || typeof data !== 'object' || !('epoch' in data)) {
			return { error: new Error('Failed to fetch') }
		}
		return data as Record<string, unknown>
	} catch (e) {
		return { error: e }
	}
}
