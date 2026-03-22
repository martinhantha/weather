import mongoose from 'mongoose'
import { defineNitroPlugin } from 'nitropack/runtime'
import { useScheduler } from '#scheduler'
import { isConfigured } from './utils/db'
import { readSaveMeasurement } from './utils/readSaveMeasurement'

export default defineNitroPlugin(async () => {
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

    // Same interval as scripts/poll-measurement.mjs; runs inside the server (no separate process).
    if (process.env.NODE_ENV !== 'development') {
        const scheduler = useScheduler()
        let inFlight = false
        scheduler
            .run(async () => {
                if (inFlight) return
                inFlight = true
                try {
                    await readSaveMeasurement()
                } finally {
                    inFlight = false
                }
            })
            .everySeconds(2)
        console.log('[scheduler] Measurement poll every 2s (nuxt-scheduler)')
    }
})
