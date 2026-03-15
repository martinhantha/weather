/**
 * CORS middleware so the weather API can be called from the embed widget
 * on other origins (and from file:// which sends origin "null").
 */
export default defineEventHandler((event) => {
	setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
	setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
	setResponseHeader(event, 'Access-Control-Max-Age', '86400')

	if (event.method === 'OPTIONS') {
		setResponseStatus(event, 204)
		return ''
	}
})
