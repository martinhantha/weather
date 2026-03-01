/**
 * Proxy to South Tyrol Foehn API.
 * Query: lang (de | it | en). Returns JSON with contents[0].imageUrl for the diagram image.
 */

const FOEHN_URL = 'http://daten.buergernetz.bz.it/services/weather/foehn'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const lang = (query.lang as string) || 'de'
	const validLang = ['de', 'it', 'en'].includes(lang) ? lang : 'de'
	try {
		const url = `${FOEHN_URL}?lang=${validLang}&format=json`
		const data = await $fetch<{ contents?: Array<{ imageUrl?: string }> }>(url)
		return data
	} catch (e) {
		console.error('Foehn fetch failed:', e)
		setResponseStatus(event, 502)
		return { error: 'Foehn API unavailable', contents: [] }
	}
})
