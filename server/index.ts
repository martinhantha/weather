import mongoose from 'mongoose'
import { isConfigured } from './utils/db'

export default async () => {
	const config = useRuntimeConfig()
	const mongoUrl = (config.mongoUrl as string)?.trim()
	const useDataApi = config.mongoUseDataApi

	if (mongoUrl && !useDataApi) {
		try {
			await mongoose.connect(mongoUrl)
			console.log('[DB] Connected with MONGODB_URI (mongoose).')
		} catch (err) {
			console.error('[DB] Mongoose connection failed:', err instanceof Error ? err.message : err)
		}
	} else if (useDataApi || isConfigured()) {
		if (useDataApi) console.log('[DB] Using MongoDB Data API (App Services).')
		else console.log('[DB] MongoDB Data API configured (fetch).')
	} else {
		console.warn('[DB] No MongoDB. Set MONGODB_URI (mongoose) or MONGODB_APP_ID + MONGODB_API_KEY (Data API). Set MONGODB_USE_DATA_API=true to force Data API.')
	}
}
