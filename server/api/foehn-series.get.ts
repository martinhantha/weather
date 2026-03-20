import { diffPressureByTime, type HourlyPressure } from '../utils/foehn-pressure-diff'

const BOZEN_LAT = 46.4977
const BOZEN_LON = 11.3128
const INNSBRUCK_LAT = 47.2602
const INNSBRUCK_LON = 11.3441
const TZ = 'Europe/Vienna'

function openMeteoHourlyUrl(
    lat: number,
    lon: number,
    pastHours: number,
    forecastHours: number
) {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        hourly: 'pressure_msl',
        timezone: TZ,
        past_hours: String(pastHours),
        forecast_hours: String(forecastHours),
        models: 'best_match',
    })
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

export default defineEventHandler(async () => {
    const pastHours = 24
    /** 4 Tage Vorhersage (96 h) */
    const forecastHours = 120

    const urlBozenPast = openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, pastHours, 0)
    const urlInnPast = openMeteoHourlyUrl(INNSBRUCK_LAT, INNSBRUCK_LON, pastHours, 0)
    /** Eine zusammenhängende best_match-Zeitreihe: erste 24 h + 96 h Vorhersage (kein Sprung zur blauen Linie) */
    const urlBozenCombo = openMeteoHourlyUrl(BOZEN_LAT, BOZEN_LON, pastHours, forecastHours)
    const urlInnCombo = openMeteoHourlyUrl(INNSBRUCK_LAT, INNSBRUCK_LON, pastHours, forecastHours)

    const [bozenPast, innPast, bozenCombo, innCombo] = await Promise.all([
        $fetch<HourlyPressure>(urlBozenPast),
        $fetch<HourlyPressure>(urlInnPast),
        $fetch<HourlyPressure>(urlBozenCombo),
        $fetch<HourlyPressure>(urlInnCombo),
    ])

    const obsMap = diffPressureByTime(bozenPast, innPast)
    const comboMap = diffPressureByTime(bozenCombo, innCombo)
    const comboTimes = [...comboMap.keys()].sort()
    const first24 = new Set(comboTimes.slice(0, pastHours))
    const last96 = new Set(comboTimes.slice(pastHours))

    const allTimes = new Set([...obsMap.keys(), ...comboMap.keys()])
    const sorted = [...allTimes].sort()

    const rows = sorted.map((time) => ({
        time,
        observation: obsMap.get(time) ?? null,
        pastForecast: first24.has(time) ? (comboMap.get(time) ?? null) : null,
        forecast: last96.has(time) ? (comboMap.get(time) ?? null) : null,
    }))

    return {
        generatedAt: new Date().toISOString(),
        timezone: TZ,
        pastHours,
        forecastHours,
        unit: 'hPa',
        note: 'Beobachtung (rot): Modellanalyse, letzte 24 h. Violett und blau sind ein durchgehender best_match-Verlauf (24 h + 96 h in einem API-Lauf) – gleiche Vorhersage am Übergang, ohne Modellwechsel. Bei jedem Laden gilt der aktuelle Modellstand.',
        sources: {
            openMeteo: {
                pastAnalysis: urlBozenPast,
                combinedForecast: urlBozenCombo,
            },
        },
        rows,
    }
})
