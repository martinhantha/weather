import mongoose from 'mongoose'
import { defineNitroPlugin } from 'nitropack/runtime'
import { useScheduler } from '#scheduler'
import { isConfigured } from './utils/db'
import { readSaveMeasurement } from './utils/readSaveMeasurement'
import { savePioupiouHistory } from './utils/pioupiouHistory'
import { PIOUPIOU_STATION_IDS } from '../shared/stations'

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
                } catch (err) {
                    console.error('[scheduler] Pichlberg poll failed:', err instanceof Error ? err.message : err)
                } finally {
                    inFlight = false
                }
            })
            .everySeconds(2)
        console.log('[scheduler] Measurement poll every 2s (nuxt-scheduler)')

        // Pioupiou (Leiter Spitz) publishes ~every 5 min; each run upserts the last day, so gaps refill.
        const savePioupiou = () => Promise.all(PIOUPIOU_STATION_IDS.map((id) => savePioupiouHistory(id)))
        void savePioupiou()
        scheduler.run(savePioupiou).everyFiveMinutes()
        console.log('[scheduler] Pioupiou wind history every 5min (nuxt-scheduler)')
    }
})
