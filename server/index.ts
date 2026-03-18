import mongoose from 'mongoose'
import { isConfigured } from './utils/db'

export default async () => {
	const config = useRuntimeConfig()
	const mongoUrl = (config.mongoUrl as string)?.trim()

	if (mongoUrl) {
		try {
			await mongoose.connect(mongoUrl)
			console.log('[DB] Connected with MONGODB_URI (mongoose).')
		} catch (err) {
			console.error('[DB] Mongoose connection failed:', err instanceof Error ? err.message : err)
		}
	} else if (isConfigured(undefined)) {
		console.log('[DB] D1 or other backend configured (no MONGODB_URI for Node).')
	} else {
		console.warn('[DB] No database. Set MONGODB_URI (local/Node) or deploy with D1 (Cloudflare).')
	}
}
