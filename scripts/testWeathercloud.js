/**
 * Same behaviour as weathercloud-js getWeather for device/METAR IDs.
 */
async function getWeather(id) {
	const deviceRegex = /^[0-9]{9,10}$/
	const metarRegex = /^[A-Z]{4}$/
	if (!deviceRegex.test(id) && !metarRegex.test(id)) {
		return { error: new Error('Invalid ID') }
	}
	const type = metarRegex.test(id) ? 'metar' : 'device'
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
		const data = await resp.json()
		if (data && typeof data === 'object' && 'error' in data && data.error === true) {
			return { error: data.err ?? data }
		}
		if (!data || typeof data !== 'object' || !('epoch' in data)) {
			return { error: new Error('Failed to fetch') }
		}
		return data
	} catch (e) {
		return { error: e }
	}
}

/**
 * getWeather accepts only:
 * - Device: 9 or 10 digits (e.g. 9123924154)
 * - METAR: 4 uppercase letters (e.g. LOWW)
 * Anything else → { error: Error("Invalid ID") }.
 *
 * "Failed to fetch" means the JSON had no `epoch` (bad/empty response, parse error,
 * or transient API/network glitch). Retrying often helps.
 */
const STATION_ID = '9123924154'

async function probeRawDeviceValues(code) {
	const url = `https://app.weathercloud.net/device/values?code=${code}`
	const res = await fetch(url, {
		method: 'post',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			'X-Requested-With': 'XMLHttpRequest',
		},
		body: '',
	})
	const text = await res.text()
	return { status: res.status, contentType: res.headers.get('content-type'), bodyPreview: text.slice(0, 400) }
}

;(async () => {
	let weather = await getWeather(STATION_ID)
	if (weather.error?.message === 'Failed to fetch') {
		weather = await getWeather(STATION_ID)
	}

	if (weather.error) {
		console.error(weather)
		if (weather.error?.message === 'Failed to fetch') {
			try {
				const probe = await probeRawDeviceValues(STATION_ID)
				console.error('Raw probe (same URL, no session cookie):', probe)
			} catch (e) {
				console.error('Raw probe failed:', e)
			}
		}
		process.exitCode = 1
		return
	}
	console.log(weather)
})()
