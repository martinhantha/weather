import { defineEventHandler, getQuery, createError } from 'h3'

type OpenMeteoResponse = {
    latitude: number
    longitude: number
    hourly?: {
        time: string[]
        wind_speed_10m?: number[]
        wind_direction_10m?: number[]
        wind_gusts_10m?: number[]
        cloud_cover?: number[]
        cloud_cover_low?: number[]
        precipitation?: number[]
        cape?: number[]
        freezing_level_height?: number[]
    }
}

type FlightHour = {
    time: string
    windSpeed: number | null
    windDirection: number | null
    gusts: number | null
    cloudCover: number | null
    lowCloudCover: number | null
    precipitation: number | null
    cape: number | null
    freezingLevel: number | null
    score: number
    rating: 'gut' | 'ok' | 'kritisch'
    reasons: string[]
}

function toNumber(value: unknown, fallback: number): number {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

function scoreFlightHour(hour: {
    windSpeed: number | null
    gusts: number | null
    precipitation: number | null
    lowCloudCover: number | null
    cape: number | null
}): { score: number; rating: 'gut' | 'ok' | 'kritisch'; reasons: string[] } {
    let score = 100
    const reasons: string[] = []

    // Sehr einfache Heuristik – nur als Startpunkt
    if (hour.windSpeed !== null) {
        if (hour.windSpeed > 25) {
            score -= 40
            reasons.push('Grundwind > 25 km/h')
        } else if (hour.windSpeed > 18) {
            score -= 20
            reasons.push('Grundwind erhöht')
        }
    }

    if (hour.gusts !== null) {
        if (hour.gusts > 35) {
            score -= 35
            reasons.push('Böen > 35 km/h')
        } else if (hour.gusts > 28) {
            score -= 15
            reasons.push('Böig')
        }
    }

    if (hour.precipitation !== null) {
        if (hour.precipitation > 1.5) {
            score -= 40
            reasons.push('Niederschlag deutlich')
        } else if (hour.precipitation > 0.2) {
            score -= 15
            reasons.push('Leichter Niederschlag')
        }
    }

    if (hour.lowCloudCover !== null) {
        if (hour.lowCloudCover > 85) {
            score -= 15
            reasons.push('Viel tiefe Bewölkung')
        } else if (hour.lowCloudCover > 60) {
            score -= 8
            reasons.push('Tiefbewölkung erhöht')
        }
    }

    // CAPE nicht pauschal schlecht, aber als grober Risikohinweis
    if (hour.cape !== null) {
        if (hour.cape > 1000) {
            score -= 25
            reasons.push('Starke Konvektion möglich')
        } else if (hour.cape > 500) {
            score -= 12
            reasons.push('Konvektion aktiv')
        }
    }

    score = Math.max(0, Math.min(100, score))

    let rating: 'gut' | 'ok' | 'kritisch' = 'gut'
    if (score < 45) rating = 'kritisch'
    else if (score < 70) rating = 'ok'

    return { score, rating, reasons }
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lat = toNumber(query.lat, NaN)
    const lon = toNumber(query.lon, NaN)
    const elevation = toNumber(query.elevation, NaN)
    const timezone = String(query.timezone || 'Europe/Rome')

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'lat und lon sind erforderlich',
        })
    }

    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        timezone,
        forecast_days: '3',
        wind_speed_unit: 'kmh',
        precipitation_unit: 'mm',
        hourly: [
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'cloud_cover',
            'cloud_cover_low',
            'precipitation',
            'cape',
            'freezing_level_height',
        ].join(','),
    })

    if (Number.isFinite(elevation)) {
        params.set('elevation', String(elevation))
    }

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`

    const data = await $fetch<OpenMeteoResponse>(url)

    if (!data.hourly?.time?.length) {
        throw createError({
            statusCode: 502,
            statusMessage: 'Keine Wetterdaten erhalten',
        })
    }

    const hours: FlightHour[] = data.hourly.time.map((time, i) => {
        const base = {
            time,
            windSpeed: data.hourly?.wind_speed_10m?.[i] ?? null,
            windDirection: data.hourly?.wind_direction_10m?.[i] ?? null,
            gusts: data.hourly?.wind_gusts_10m?.[i] ?? null,
            cloudCover: data.hourly?.cloud_cover?.[i] ?? null,
            lowCloudCover: data.hourly?.cloud_cover_low?.[i] ?? null,
            precipitation: data.hourly?.precipitation?.[i] ?? null,
            cape: data.hourly?.cape?.[i] ?? null,
            freezingLevel: data.hourly?.freezing_level_height?.[i] ?? null,
        }

        const scored = scoreFlightHour(base)

        return {
            ...base,
            ...scored,
        }
    })

    return {
        source: 'open-meteo',
        location: {
            latitude: data.latitude,
            longitude: data.longitude,
            elevation: Number.isFinite(elevation) ? elevation : null,
            timezone,
        },
        hours,
    }
})