export type HourlyPressure = {
    hourly?: { time: string[]; pressure_msl?: (number | null)[] }
}

/** Δp Bozen − Innsbruck pro Zeitstempel; Paarung über Zeit-String, nicht Index. */
export function diffPressureByTime(
    bozen: HourlyPressure,
    inn: HourlyPressure
): Map<string, number> {
    const map = new Map<string, number>()
    const times = bozen.hourly?.time ?? []
    const pb = bozen.hourly?.pressure_msl ?? []
    const innTimes = inn.hourly?.time ?? []
    const pi = inn.hourly?.pressure_msl ?? []
    const piByTime = new Map<string, number>()
    for (let i = 0; i < innTimes.length; i++) {
        const t = innTimes[i]
        const v = pi[i]
        if (t == null || v == null) continue
        const n = Number(v)
        if (Number.isFinite(n)) piByTime.set(t, n)
    }
    for (let i = 0; i < times.length; i++) {
        const t = times[i]
        const tb = pb[i]
        const ti = t != null ? piByTime.get(t) : undefined
        if (tb == null || ti == null) continue
        const d = Number(tb) - ti
        if (!Number.isFinite(d)) continue
        map.set(t, Number(d.toFixed(1)))
    }
    return map
}
