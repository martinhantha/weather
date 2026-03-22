<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ICondition, IStationConfig } from '../../types'

const props = withDefaults(
    defineProps<{ apiUrl: string; debug?: boolean }>(),
    { debug: false }
)

const STATIONS: IStationConfig[] = [
    { id: '33570', name: 'Pichlberg', source: 'weatherlink', station_id: '33570' },
    { id: '92575', name: 'Sattele', source: 'weatherlink', station_id: '92575' },
    { id: 'ISARNT29', name: 'Reinswald', source: 'pws', station_id: 'ISARNT29' },
    { id: 'ISARNT1', name: 'Moosbrugg', source: 'pws', station_id: 'ISARNT1' },
    { id: '82200MS', name: 'Sarnthein', source: 'southtyrol', station_code: '82200MS' },
    { id: '82910MS', name: 'Jenesien', source: 'southtyrol', station_code: '82910MS' },
    { id: '80100SF', name: 'Pens Tramintal', source: 'southtyrol', station_code: '80100SF' },
    { id: '35100WS', name: 'Jaufen', source: 'southtyrol', station_code: '35100WS' },
    { id: '82500WS', name: 'Rittnerhorn', source: 'southtyrol', station_code: '82500WS' },
    { id: '69900MS', name: 'Plose', source: 'southtyrol', station_code: '69900MS' },
    { id: '66000WS', name: 'Dannelspitz', source: 'southtyrol', station_code: '66000WS' },
    { id: '37100MS', name: 'Sterzing', source: 'southtyrol', station_code: '37100MS' },
    { id: '06040WS', name: 'Sulden Schöntaufspitze', source: 'southtyrol', station_code: '06040WS' },
]

const LIVE_STATION_IDS = new Set(['33570', 'ISARNT29', 'ISARNT1'])
const SOUTH_TIROL_CODES = STATIONS.filter((s) => s.source === 'southtyrol').map((s) => s.station_code!).join(',')

const measurement = ref<any>(null)
const windStations = ref<Record<string, { ts: number; condition: Partial<ICondition> }> | null>(null)
const southTyrol = ref<Record<string, { ts: number } & Partial<ICondition>> | null>(null)
const pwsData = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const pwsDataIsarnt1 = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weatherlinkSattele = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weatherlinkPichlberg = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
type SeriesRow = {
    time: string
    observation: number | null
    pastForecast: number | null
    forecast: number | null
}

const loading = ref(true)
const error = ref<string | null>(null)
const foehnDiff = ref<{
    differenceStation?: number | null
    generatedAt?: string
} | null>(null)
const foehnSeries = ref<{
    rows: SeriesRow[]
    generatedAt?: string
} | null>(null)
const debugLog = ref<string[]>([])
const apiStatus = ref<Record<string, string>>({})

const base = () => (props.apiUrl || '').replace(/\/$/, '')
function log(msg: string) {
    debugLog.value = [...debugLog.value, `[${new Date().toISOString().slice(11, 23)}] ${msg}`].slice(-30)
    if (typeof console !== 'undefined') console.log('[WeatherWidget]', msg)
}

function getStationData(station: IStationConfig): { ts: number; condition: Partial<ICondition> } | null {
    if (station.source === 'weatherlink' && windStations.value?.[station.station_id!]) {
        return windStations.value[station.station_id!]
    }
    if (station.source === 'weatherlink' && station.station_id === '92575' && weatherlinkSattele.value) {
        return weatherlinkSattele.value
    }
    if (station.source === 'weatherlink' && station.station_id === '33570' && weatherlinkPichlberg.value) {
        return weatherlinkPichlberg.value
    }
    if (station.source === 'pws' && station.station_id === 'ISARNT29' && pwsData.value) {
        return pwsData.value
    }
    if (station.source === 'pws' && station.station_id === 'ISARNT1' && pwsDataIsarnt1.value) {
        return pwsDataIsarnt1.value
    }
    if (station.source === 'southtyrol' && southTyrol.value?.[station.station_code!]) {
        const d = southTyrol.value[station.station_code!]
        return { ts: d.ts, condition: d }
    }
    if (station.source === 'weatherlink' && station.station_id === '33570' && measurement.value?.json?.data) {
        const d = measurement.value.json.data
        if (d?.conditions?.[0]) return { ts: d.ts, condition: d.conditions[0] }
    }
    return null
}

function windDirDeg(cond: Partial<ICondition> | null, stationId: string): number {
    const raw = cond?.wind_dir_last ?? 0
    if (stationId === '33570') return (raw + 180) % 360
    return raw
}

function degToDir(deg: number): string {
    const n = Math.round(deg / 22.5 + 0.5)
    const dirs = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    return dirs[n % 16]
}

function windSpeedColor(speed: number | null | undefined): string {
    if (speed == null) return 'w-wind-gray'
    if (speed <= 14) return 'w-wind-green'
    if (speed <= 25) return 'w-wind-yellow'
    if (speed <= 30) return 'w-wind-orange'
    if (speed <= 38) return 'w-wind-red'
    return 'w-wind-black'
}

function formatDayLabel(iso: string) {
    return new Date(iso).toLocaleDateString('de-AT', {
        timeZone: 'Europe/Vienna',
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
    })
}

/** Same priority as foehn.vue: series timestamp preferred for consistency with the chart */
const calculationInstant = computed(
    () => foehnSeries.value?.generatedAt ?? foehnDiff.value?.generatedAt ?? '',
)

function formatCalculationTime(iso: string) {
    if (!iso) return '–'
    return new Date(iso).toLocaleString('de-AT', {
        timeZone: 'Europe/Vienna',
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const chart = computed(() => {
    const rows = foehnSeries.value?.rows ?? []
    if (!rows.length) return null

    const nums: number[] = []
    for (const r of rows) {
        if (r.observation != null) nums.push(r.observation)
        if (r.pastForecast != null) nums.push(r.pastForecast)
        if (r.forecast != null) nums.push(r.forecast)
    }
    if (!nums.length) return null

    let minY = Math.min(...nums, 0)
    let maxY = Math.max(...nums, 0)
    if (minY === maxY) {
        minY -= 1
        maxY += 1
    }
    const padY = (maxY - minY) * 0.08
    minY -= padY
    maxY += padY

    const w = 1000
    const h = 340
    const pl = 52
    const pr = 28
    const pt = 28
    const pb = 52
    const innerW = w - pl - pr
    const innerH = h - pt - pb
    const n = rows.length

    const xAt = (i: number) => pl + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const yAt = (v: number) => pt + innerH - ((v - minY) / (maxY - minY)) * innerH

    const obsPts: [number, number][] = []
    const pastFcPts: [number, number][] = []
    const fcPts: [number, number][] = []
    rows.forEach((r, i) => {
        if (r.observation != null) obsPts.push([xAt(i), yAt(r.observation)])
        if (r.pastForecast != null) pastFcPts.push([xAt(i), yAt(r.pastForecast)])
        if (r.forecast != null) fcPts.push([xAt(i), yAt(r.forecast)])
    })

    const toPath = (pts: [number, number][]) => {
        if (!pts.length) return ''
        let d = `M ${pts[0][0]} ${pts[0][1]}`
        for (let k = 1; k < pts.length; k++) d += ` L ${pts[k][0]} ${pts[k][1]}`
        return d
    }

    const zeroInRange = 0 >= minY && 0 <= maxY
    const yZero = zeroInRange ? yAt(0) : null

    type Pt = { x: number; y: number; v: number }

    const ptsWithZeroCrossings = (key: 'observation' | 'forecast'): Pt[] => {
        const indices: number[] = []
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][key] != null) indices.push(i)
        }
        const out: Pt[] = []
        for (let k = 0; k < indices.length; k++) {
            const i = indices[k]
            const v = rows[i][key]!
            if (k > 0 && yZero != null) {
                const i0 = indices[k - 1]
                const v0 = rows[i0][key]!
                if (v0 * v < 0) {
                    const t = v0 / (v0 - v)
                    const xZ = xAt(i0) + t * (xAt(i) - xAt(i0))
                    out.push({ x: xZ, y: yZero, v: 0 })
                }
            }
            out.push({ x: xAt(i), y: yAt(v), v })
        }
        return out
    }

    const pathsBetweenCurveAndZero = (pts: Pt[], positive: boolean): string => {
        if (yZero == null) return ''
        const parts: string[] = []
        let run: Pt[] = []
        const flush = (closingX?: number) => {
            if (!run.length) return
            const xBase = closingX ?? run[run.length - 1].x
            let d = `M ${run[0].x} ${yZero} L ${run[0].x} ${run[0].y}`
            for (let k = 1; k < run.length; k++) d += ` L ${run[k].x} ${run[k].y}`
            d += ` L ${xBase} ${yZero} Z`
            parts.push(d)
            run = []
        }
        for (const p of pts) {
            if (positive ? p.v > 0 : p.v < 0) {
                run.push(p)
            } else if (p.v === 0) {
                flush(p.x)
            } else {
                flush()
            }
        }
        flush()
        return parts.join(' ')
    }

    const fillPositiveRedPath =
        yZero != null
            ? [
                  pathsBetweenCurveAndZero(ptsWithZeroCrossings('observation'), true),
                  pathsBetweenCurveAndZero(ptsWithZeroCrossings('forecast'), true),
              ]
                  .filter((s) => s.length > 0)
                  .join(' ')
            : ''
    const fillFcBelowPath =
        yZero != null ? pathsBetweenCurveAndZero(ptsWithZeroCrossings('forecast'), false) : ''

    const yTicks = 5
    const tickVals: number[] = []
    for (let t = 0; t <= yTicks; t++) {
        tickVals.push(minY + (t / yTicks) * (maxY - minY))
    }

    const midnightX: number[] = []
    const midnightIndices: number[] = []
    rows.forEach((r, i) => {
        if (/T00:00(:00)?$/.test(r.time)) {
            midnightX.push(xAt(i))
            midnightIndices.push(i)
        }
    })

    const xEnd = pl + innerW
    const midnightLabels: { x: number; time: string }[] = midnightIndices.map((idx, k) => {
        const xStart = xAt(idx)
        const xNext = k + 1 < midnightIndices.length ? xAt(midnightIndices[k + 1]) : xEnd
        return { x: (xStart + xNext) / 2, time: rows[idx].time }
    })

    if (midnightIndices.length > 0 && midnightIndices[0] > 0) {
        const xFirst = pl
        const xMid = (xFirst + xAt(midnightIndices[0])) / 2
        midnightLabels.unshift({ x: xMid, time: rows[0].time })
    }

    return {
        w,
        h,
        midnightX,
        midnightLabels,
        minY,
        maxY,
        obsPath: toPath(obsPts),
        pastFcPath: toPath(pastFcPts),
        fcPath: toPath(fcPts),
        yZero,
        fillPositiveRedPath,
        fillFcBelowPath,
        zeroInRange,
        tickVals,
        yAt,
        pl,
        pr,
        pt,
        pb,
        innerW,
        innerH,
        xTickIdx: [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i),
        rows,
    }
})

function windSpeedColorHex(speed: number | null | undefined): string {
    if (speed == null) return '#6b7280'
    if (speed <= 14) return '#16a34a'
    if (speed <= 25) return '#eab308'
    if (speed <= 30) return '#ea580c'
    if (speed <= 38) return '#dc2626'
    return '#000000'
}

/** After PWS failure, skip PWS fetches until then (aligned with server error cache, default 5m). */
const PWS_ERROR_BACKOFF_MS = 300_000
let pwsBackoffUntil = 0

async function fetchAll() {
    const b = base()
    if (!b) {
        error.value = 'apiUrl is missing or empty'
        loading.value = false
        if (props.debug) log('fetchAll: no apiUrl')
        return
    }
    error.value = null
    if (props.debug) log(`fetchAll: ${b}`)
    try {
        const now = Date.now()
        const runPws = now >= pwsBackoffUntil

        const [measRes, windRes, southRes, satteleRes, pichlbergRes] = await Promise.all([
            fetch(`${b}/api/measurement`),
            fetch(`${b}/api/wind-stations`),
            fetch(`${b}/api/southtyrol/sensors?station_codes=${SOUTH_TIROL_CODES}`),
            fetch(`${b}/api/weatherlink/current?stationId=92575`),
            fetch(`${b}/api/weatherlink/current?stationId=33570`),
        ])

        let pwsRes29: Response | null = null
        let pwsResIsarnt1: Response | null = null
        if (runPws) {
            ;[pwsRes29, pwsResIsarnt1] = await Promise.all([
                fetch(`${b}/api/pws/observations?stationId=ISARNT29`),
                fetch(`${b}/api/pws/observations?stationId=ISARNT1`),
            ])
        }

        apiStatus.value = {
            measurement: `${measRes.status} ${measRes.statusText}`,
            windStations: `${windRes.status} ${windRes.statusText}`,
            southtyrol: `${southRes.status} ${southRes.statusText}`,
            pws29: pwsRes29 ? `${pwsRes29.status} ${pwsRes29.statusText}` : 'skipped (error backoff)',
            pwsIsarnt1: pwsResIsarnt1 ? `${pwsResIsarnt1.status} ${pwsResIsarnt1.statusText}` : 'skipped (error backoff)',
            weatherlinkSattele: `${satteleRes.status} ${satteleRes.statusText}`,
            weatherlinkPichlberg: `${pichlbergRes.status} ${pichlbergRes.statusText}`,
        }
        if (props.debug) log(JSON.stringify(apiStatus.value))
        if (measRes.ok) measurement.value = await measRes.json()
        if (windRes.ok) windStations.value = await windRes.json()
        if (southRes.ok) {
            const data = await southRes.json()
            southTyrol.value = data
        }
        if (pwsRes29?.ok) pwsData.value = await pwsRes29.json()
        if (pwsResIsarnt1?.ok) pwsDataIsarnt1.value = await pwsResIsarnt1.json()
        if (runPws && pwsRes29 && pwsResIsarnt1) {
            if (!pwsRes29.ok || !pwsResIsarnt1.ok) {
                pwsBackoffUntil = Date.now() + PWS_ERROR_BACKOFF_MS
            } else {
                pwsBackoffUntil = 0
            }
        }
        if (satteleRes.ok) weatherlinkSattele.value = await satteleRes.json()
        if (pichlbergRes.ok) weatherlinkPichlberg.value = await pichlbergRes.json()
    } catch (e: any) {
        error.value = e?.message || 'Failed to load data'
        if (props.debug) log(`error: ${error.value}`)
    } finally {
        loading.value = false
    }
}

/** Wird in `finally` gesetzt — für „Tab wieder aktiv“-Auffrischung */
let lastFoehnFetchAt = 0

async function fetchFoehn() {
    const b = base()
    if (!b) return
    try {
        const [dRes, sRes] = await Promise.all([fetch(`${b}/api/foehn-diff`), fetch(`${b}/api/foehn-series`)])
        if (dRes.ok) foehnDiff.value = await dRes.json()
        if (sRes.ok) foehnSeries.value = await sRes.json()
    } catch {
        /* keep previous foehn data */
    } finally {
        lastFoehnFetchAt = Date.now()
    }
}

/** Wie Föhn-Seite: alle 5 Minuten neu laden (nur sichtbarer Tab) */
const FOEHN_POLL_MS = 5 * 60 * 1000

function tickFoehnIfVisible() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchFoehn()
    }
}

function onFoehnVisibility() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (lastFoehnFetchAt > 0 && Date.now() - lastFoehnFetchAt >= FOEHN_POLL_MS) {
        fetchFoehn()
    }
}

onMounted(() => {
    if (props.debug) log('Widget mounted')
    fetchAll()
    fetchFoehn()
    const t = setInterval(fetchAll, 2000)
    const tf = setInterval(tickFoehnIfVisible, FOEHN_POLL_MS)
    document.addEventListener('visibilitychange', onFoehnVisibility)
    return () => {
        clearInterval(t)
        clearInterval(tf)
        document.removeEventListener('visibilitychange', onFoehnVisibility)
    }
})
</script>

<template>
    <div class="w-root">
        <!-- Debug panel: always visible when debug=true, shows state and API status -->
        <div v-if="props.debug" class="w-debug">
            <div class="w-debug-title">Weather Widget [DEBUG]</div>
            <div class="w-debug-row"><strong>apiUrl:</strong> {{ props.apiUrl || '(empty)' }}</div>
            <div class="w-debug-row"><strong>loading:</strong> {{ loading }}</div>
            <div class="w-debug-row"><strong>error:</strong> {{ error || '—' }}</div>
            <div class="w-debug-row"><strong>API status:</strong></div>
            <ul class="w-debug-list">
                <li v-for="(val, key) in apiStatus" :key="key">{{ key }}: {{ val }}</li>
            </ul>
            <div class="w-debug-log">
                <strong>Log (last 10):</strong>
                <pre>{{ debugLog.slice(-10).join('\n') || '—' }}</pre>
            </div>
        </div>
        <div v-if="loading && !error" class="w-loading">Lade Winddaten…</div>
        <div v-else-if="error" class="w-error">{{ error }}</div>
        <template v-else>
            <section class="w-section">
                <div class="w-grid">
                    <template v-for="station in STATIONS" :key="station.id">
                        <article v-if="getStationData(station)" class="w-card">
                            <div class="w-card-inner">
                                <div class="w-card-top">
                                    <p class="w-station-name">{{ station.name }}</p>
                                    <div class="w-card-top-right">
                                        <span v-if="getStationData(station)!.condition.temp != null" class="w-temp-top">
                                            {{ getStationData(station)!.condition.temp }} °C
                                        </span>
                                        <span v-if="getStationData(station)?.ts" class="w-time">
                                            {{ new Date(getStationData(station)!.ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}
                                        </span>
                                        <span v-if="LIVE_STATION_IDS.has(station.id)" class="w-live">
                                            <span class="w-live-dot" />
                                            LIVE
                                        </span>
                                    </div>
                                </div>

                                <div class="w-card-bottom">
                                    <div class="w-winds">
                                        <span :class="windSpeedColor(getStationData(station)!.condition.wind_speed_last)">
                                            <strong>{{ getStationData(station)!.condition.wind_speed_last ?? '—' }}</strong><span class="w-wind-unit-small"> km/h</span>
                                        </span>
                                        <span :class="windSpeedColor(getStationData(station)!.condition.wind_speed_hi_last_10_min)">
                                            <strong>{{ getStationData(station)!.condition.wind_speed_hi_last_10_min ?? '—' }}</strong><span class="w-wind-unit-small"> km/h 10′ max</span>
                                        </span>
                                        <span class="w-avg">
                                            <strong>{{ getStationData(station)!.condition.wind_speed_avg_last_10_min ?? '—' }}</strong><span class="w-wind-unit-small"> km/h 10′ Ø</span>
                                        </span>
                                    </div>

                                    <div class="w-dir-wrap">
                                        <svg v-if="getStationData(station)!.condition.wind_dir_last != null" viewBox="0 0 24 12" class="w-arrow" :style="{ transform: `rotate(${(windDirDeg(getStationData(station)!.condition, station.id) + 180) % 360}deg)` }">
                                            <path d="M12 0 L9 12 L12 11 L15 12 Z" :fill="windSpeedColorHex(getStationData(station)!.condition.wind_speed_hi_last_10_min ?? null)" :stroke="windSpeedColorHex(getStationData(station)!.condition.wind_speed_last ?? null)" stroke-width="0.8" stroke-linejoin="round" />
                                        </svg>
                                        <span class="w-dir-text">
                                            {{
                                                getStationData(station)!.condition.wind_dir_last != null
                                                    ? degToDir(windDirDeg(getStationData(station)!.condition, station.id))
                                                    : '—'
                                            }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </template>
                </div>
            </section>

            <section class="w-section w-foehn">
                <div class="w-foehn-delta-row">
                    <p class="w-foehn-delta">
                        Δp Station (Bozen − Innsbruck):
                        <strong>{{ foehnDiff?.differenceStation ?? '–' }} hPa</strong>
                    </p>
                    <p class="w-foehn-calc-time">
                        {{ formatCalculationTime(calculationInstant) }}
                    </p>
                </div>

                <div v-if="chart" class="w-foehn-chart-wrap">
                    <svg
                        class="w-foehn-svg"
                        :viewBox="`0 0 ${chart.w} ${chart.h}`"
                        role="img"
                        aria-label="Diagramm Druckdifferenz Bozen minus Innsbruck: Beobachtung und Vorhersage"
                    >
                        <rect
                            :x="chart.pl"
                            :y="chart.pt"
                            :width="chart.innerW"
                            :height="chart.innerH"
                            fill="#f8fafc"
                            stroke="#e2e8f0"
                            stroke-width="1"
                        />

                        <path
                            v-if="chart.fillPositiveRedPath"
                            :d="chart.fillPositiveRedPath"
                            fill="rgb(244 63 94 / 0.35)"
                            pointer-events="none"
                        />
                        <path
                            v-if="chart.fillFcBelowPath"
                            :d="chart.fillFcBelowPath"
                            fill="rgb(14 165 233 / 0.35)"
                            pointer-events="none"
                        />

                        <g>
                            <line
                                v-for="(tv, gi) in chart.tickVals"
                                :key="'h' + gi"
                                :x1="chart.pl"
                                :x2="chart.pl + chart.innerW"
                                :y1="chart.yAt(tv)"
                                :y2="chart.yAt(tv)"
                                stroke="#cbd5e1"
                                stroke-dasharray="4 4"
                                stroke-width="1"
                            />
                        </g>

                        <g>
                            <line
                                v-for="(mx, mi) in chart.midnightX"
                                :key="'mid' + mi"
                                :x1="mx"
                                :x2="mx"
                                :y1="chart.pt"
                                :y2="chart.pt + chart.innerH"
                                stroke="#94a3b8"
                                stroke-opacity="0.55"
                                stroke-width="0.45"
                            />
                        </g>

                        <line
                            v-if="chart.yZero != null"
                            :x1="chart.pl"
                            :x2="chart.pl + chart.innerW"
                            :y1="chart.yZero"
                            :y2="chart.yZero"
                            stroke="#059669"
                            stroke-width="2"
                        />

                        <g class="w-foehn-axis-y" font-size="11" text-anchor="end">
                            <text
                                v-for="(tv, gi) in chart.tickVals"
                                :key="'yl' + gi"
                                :x="chart.pl - 8"
                                :y="chart.yAt(tv)"
                                dominant-baseline="middle"
                            >
                                {{ tv.toFixed(1) }}
                            </text>
                        </g>

                        <g class="w-foehn-axis-x" font-size="11" text-anchor="middle">
                            <text
                                v-for="ml in chart.midnightLabels"
                                :key="'mid-lbl-' + ml.time"
                                :x="ml.x"
                                :y="chart.h - 18"
                            >
                                {{ formatDayLabel(ml.time) }}
                            </text>
                        </g>

                        <text class="w-foehn-unit" font-size="11" :x="chart.pl" :y="14">Δp (hPa)</text>

                        <path
                            v-if="chart.fcPath"
                            :d="chart.fcPath"
                            fill="none"
                            stroke="#0284c7"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />

                        <path
                            v-if="chart.obsPath"
                            :d="chart.obsPath"
                            fill="none"
                            stroke="#e11d48"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>

                    <div class="w-foehn-legend">
                        <span class="w-foehn-legend-item">
                            <span class="w-foehn-legend-line w-foehn-legend-obs" />
                            Beobachtung
                        </span>
                        <span class="w-foehn-legend-item">
                            <span class="w-foehn-legend-line w-foehn-legend-fc" />
                            Vorhersage
                        </span>
                        <span class="w-foehn-legend-item">
                            <span class="w-foehn-legend-zero" />
                            Δp = 0
                        </span>
                    </div>
                </div>
            </section>
        </template>
    </div>
</template>

<style scoped>
.w-root {
    font-size: 17.5px !important;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans',
        'Liberation Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

}

.w-debug {
    background: #1e293b;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    max-height: 280px;
    overflow: auto;
}

.w-debug-title {
    font-weight: 700;
    margin-bottom: 8px;
    color: #fbbf24;
}

.w-debug-row,
.w-debug-list {
    margin: 4px 0;
}

.w-debug-list {
    list-style: none;
    padding-left: 0;
}

.w-debug-log {
    margin-top: 8px;
}

.w-debug-log pre {
    margin: 4px 0 0;
    font-size: 0.75em;
    white-space: pre-wrap;
    word-break: break-all;
}

.w-loading,
.w-error {
    padding: 1em;
    text-align: center;
    color: #6b7280;
}

.w-error {
    color: #dc2626;
}

.w-section {
    max-width: 100%;
}

.w-header {
    margin-bottom: 1em;
    padding: 1.25em;
    border-radius: 0.75em;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.w-title {
    font-size: 1.125em;
    font-weight: 600;
    margin: 0;
    color: #111827;
}

.w-subtitle {
    font-size: 0.875em;
    color: #6b7280;
    margin: 0.25em 0 0;
}

.w-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.7em;
}

@media (min-width: 1024px) {
    .w-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

.w-card {
    border: 1px solid #e5e7eb;
    border-radius: 0.75em;
    background: #f3f3f3;
    padding: 0.75em;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: border-color 150ms ease, box-shadow 150ms ease;
}

.w-card:hover {
    border-color: #7dd3fc;
    /* sky-300 */
    box-shadow: 0 1px 10px rgba(56, 189, 248, 0.2);
}

.w-card-inner {
    width: 100%;
}

.w-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75em;
    padding-bottom: 0.5em;
    border-bottom: 1px solid #f3f4f6;
    margin-bottom: 0.5em;
}

.w-card-top-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5em;
    flex-shrink: 0;
}

.w-temp-top {
    font-size: 0.875em;
    color: #111827;
    font-weight: 500;
}

.w-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75em;
}

.w-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75em;
}

.w-station-name {
    font-weight: 600;
    margin: 0;
    color: #111827;
}

.w-card-meta {
    display: flex;
    align-items: center;
    gap: 0.5em;
    flex-shrink: 0;
}

.w-time {
    font-size: 0.75em;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
}

.w-wind-unit-small {
    font-size: 0.6em;
    color: #6b7280;
    /* neutral gray-500; do not inherit wind-speed color */
}

.w-live {
    display: inline-flex;
    align-items: center;
    gap: 0.375em;
    font-size: 0.75em;
    font-weight: 500;
    padding: 0 0.5em;
    border-radius: 9999px;
}

.w-live-dot {
    width: 0.375em;
    height: 0.375em;
    border-radius: 9999px;
    background: #059669;
    animation: w-live-pulse 1.2s ease-in-out infinite;
}

@keyframes w-live-pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.35);
        opacity: 0.7;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.w-card-body {
    margin-top: 1em;
    padding-top: 1em;
    border-top: 1px solid #f3f4f6;
}

.w-winds {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25em 0.5em;
    margin-bottom: 0;
    color: #4b5563;
}

.w-sep {
    color: #d1d5db;
}

.w-dot {
    color: #d1d5db;
}

.w-aktuell {
    color: #9ca3af;
    /* gray-400 */
    font-size: 0.875em;
}

.w-avg {
    color: #4b5563;
}

.w-wind-gray {
    color: #6b7280;
}

.w-wind-green {
    color: #16a34a;
}

.w-wind-yellow {
    color: #eab308;
}

.w-wind-orange {
    color: #ea580c;
}

.w-wind-red {
    color: #dc2626;
}

.w-wind-black {
    color: #000;
}

.w-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5em;
}

.w-dir-wrap {
    display: flex;
    align-items: center;
    gap: 0.5em;
}

.w-label {
    font-size: 1em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
}

.w-dir {
    font-weight: 600;
    color: #111827;
}

.w-dir-text {
    font-weight: 600;
    color: #111827;
    font-size: 0.875em;
}

.w-arrow {
    width: 2.5em;
    height: 2.5em;
}

.w-temp {
    display: flex;
    align-items: baseline;
    gap: 0.375em;
}

.w-temp-val {
    font-weight: 600;
    color: #111827;
}

.w-no-data {
    margin-top: 1em;
    padding-top: 1em;
    border-top: 1px solid #f3f4f6;
    font-size: 1em;
    color: #6b7280;
}

.w-foehn {
    margin-top: 1.25em;
    padding-top: 1.25em;
    border-top: 1px solid #e5e7eb;
}

.w-foehn-delta-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75em 1em;
    flex-wrap: wrap;
    margin: 0 0 1em;
}

.w-foehn-delta {
    margin: 0;
    color: #1e293b;
    line-height: 1.45;
}

.w-foehn-delta strong {
    font-weight: 600;
}

.w-foehn-calc-time {
    margin: 0;
    font-size: 0.75em;
    color: #64748b;
    font-variant-numeric: tabular-nums;
    text-align: right;
    flex-shrink: 0;
    line-height: 1.45;
}

.w-foehn-chart-wrap {
    border-radius: 0.5em;
    border: 1px solid #e2e8f0;
    background: #fff;
    padding: 1em 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.w-foehn-svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: min(420px, 55vh);
}

.w-foehn-axis-y {
    fill: #64748b;
    font-family: system-ui, sans-serif;
}

.w-foehn-axis-x {
    fill: #475569;
    font-family: system-ui, sans-serif;
}

.w-foehn-unit {
    fill: #64748b;
    font-family: system-ui, sans-serif;
}

.w-foehn-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em 1.5em;
    margin-top: 0.75em;
    font-size: 0.75em;
    color: #475569;
    padding: 0 1em;
}

.w-foehn-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
}

.w-foehn-legend-line {
    display: inline-block;
    width: 1.5em;
    height: 2px;
}

.w-foehn-legend-obs {
    background: #e11d48;
}

.w-foehn-legend-fc {
    background: #0284c7;
}

.w-foehn-legend-zero {
    display: inline-block;
    width: 1.5em;
    height: 2px;
    background: #059669;
}
</style>
