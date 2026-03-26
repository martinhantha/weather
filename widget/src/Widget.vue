<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ICondition, IStationConfig } from '../../types'
import FoehnPressureChart from './FoehnPressureChart.vue'
import WindStationGrid from '../../shared/components/WindStationGrid'
import { STATIONS, LIVE_STATION_IDS, getSouthTyrolCodes } from '../../shared/stations'

const props = withDefaults(
    defineProps<{ apiUrl: string; debug?: boolean }>(),
    { debug: false }
)

const SOUTH_TIROL_CODES = getSouthTyrolCodes()

const measurement = ref<any>(null)
const windStations = ref<Record<string, { ts: number; condition: Partial<ICondition> }> | null>(null)
const southTyrol = ref<Record<string, { ts: number } & Partial<ICondition>> | null>(null)
const pwsData = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const pwsDataIsarnt1 = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weatherlinkSattele = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weatherlinkPichlberg = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weathercloudDeviceId = STATIONS.find((s: IStationConfig) => s.source === 'weathercloud')?.station_id ?? '9123924154'
const weathercloudData = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
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
    if (station.source === 'weathercloud' && station.station_id === weathercloudDeviceId && weathercloudData.value) {
        return weathercloudData.value
    }
    if (station.source === 'weatherlink' && station.station_id === '33570' && measurement.value?.json?.data) {
        const d = measurement.value.json.data
        if (d?.conditions?.[0]) return { ts: d.ts, condition: d.conditions[0] }
    }
    return null
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

const foehnRows = computed(() => foehnSeries.value?.rows ?? [])

/** After PWS failure, skip PWS fetches until then (aligned with server error cache, default 5m). */
const PWS_ERROR_BACKOFF_MS = 300_000
let pwsBackoffUntil = 0

/** Weathercloud values are typically refreshed quickly, but we still throttle to 60s. */
const WEATHERCLOUD_POLL_MS = 60_000
const WEATHERCLOUD_ERROR_BACKOFF_MS = 300_000
let weathercloudBackoffUntil = 0

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
        const runWeathercloud = now >= weathercloudBackoffUntil

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

        let weathercloudRes: Response | null = null
        if (runWeathercloud) {
            weathercloudRes = await fetch(`${b}/api/weathercloud/current?deviceId=${encodeURIComponent(weathercloudDeviceId)}`)
        }

        apiStatus.value = {
            measurement: `${measRes.status} ${measRes.statusText}`,
            windStations: `${windRes.status} ${windRes.statusText}`,
            southtyrol: `${southRes.status} ${southRes.statusText}`,
            weathercloud: weathercloudRes ? `${weathercloudRes.status} ${weathercloudRes.statusText}` : 'skipped (rate limit)',
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
        if (weathercloudRes?.ok) weathercloudData.value = await weathercloudRes.json()
        if (runWeathercloud) {
            if (!weathercloudRes?.ok) {
                weathercloudBackoffUntil = Date.now() + WEATHERCLOUD_ERROR_BACKOFF_MS
            } else {
                weathercloudBackoffUntil = Date.now() + WEATHERCLOUD_POLL_MS
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
                    <WindStationGrid
                        variant="widget"
                        :stations="STATIONS"
                        :liveStationIds="LIVE_STATION_IDS"
                        :getStationData="getStationData"
                    />
                </div>
            </section>

            <section class="w-section w-foehn">
                <div class="w-foehn-delta-row">
                    <p class="w-foehn-delta">
                        Δp Bozen − Innsbruck:
                        <strong>{{ foehnDiff?.differenceStation ?? '–' }} hPa</strong>
                    </p>
                    <p class="w-foehn-calc-time">
                        {{ formatCalculationTime(calculationInstant) }}
                    </p>
                </div>

                <div v-if="foehnRows.length" class="w-foehn-chart-wrap">
                    <FoehnPressureChart :rows="foehnRows" :font-size="11" />
                </div>
            </section>
        </template>
    </div>
</template>

<style>
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
    padding-bottom: 0;
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


</style>
