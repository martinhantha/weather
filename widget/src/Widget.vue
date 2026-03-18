<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ICondition, IStationConfig } from './types'

const props = withDefaults(
  defineProps<{ apiUrl: string; debug?: boolean }>(),
  { debug: false }
)

const STATIONS: IStationConfig[] = [
  { id: '33570', name: 'Pichlberg', source: 'weatherlink', station_id: '33570' },
  { id: '92575', name: 'Sattele', source: 'weatherlink', station_id: '92575' },
  { id: 'ISARNT29', name: 'Reinswald', source: 'pws', station_id: 'ISARNT29' },
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

const LIVE_STATION_IDS = new Set(['33570', 'ISARNT29'])
const SOUTH_TIROL_CODES = STATIONS.filter((s) => s.source === 'southtyrol').map((s) => s.station_code!).join(',')

const measurement = ref<any>(null)
const windStations = ref<Record<string, { ts: number; condition: Partial<ICondition> }> | null>(null)
const southTyrol = ref<Record<string, { ts: number } & Partial<ICondition>> | null>(null)
const pwsData = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weatherlinkSattele = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const weatherlinkPichlberg = ref<{ ts: number; condition: Partial<ICondition> } | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
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
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
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

function windSpeedColorHex(speed: number | null | undefined): string {
  if (speed == null) return '#6b7280'
  if (speed <= 14) return '#16a34a'
  if (speed <= 25) return '#eab308'
  if (speed <= 30) return '#ea580c'
  if (speed <= 38) return '#dc2626'
  return '#000000'
}

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
    const [measRes, windRes, southRes, pwsRes, satteleRes, pichlbergRes] = await Promise.all([
      fetch(`${b}/api/measurement`),
      fetch(`${b}/api/wind-stations`),
      fetch(`${b}/api/southtyrol/sensors?station_codes=${SOUTH_TIROL_CODES}`),
      fetch(`${b}/api/pws/observations?stationId=ISARNT29`),
      fetch(`${b}/api/weatherlink/current?stationId=92575`),
      fetch(`${b}/api/weatherlink/current?stationId=33570`),
    ])
    apiStatus.value = {
      measurement: `${measRes.status} ${measRes.statusText}`,
      windStations: `${windRes.status} ${windRes.statusText}`,
      southtyrol: `${southRes.status} ${southRes.statusText}`,
      pws: `${pwsRes.status} ${pwsRes.statusText}`,
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
    if (pwsRes.ok) pwsData.value = await pwsRes.json()
    if (satteleRes.ok) weatherlinkSattele.value = await satteleRes.json()
    if (pichlbergRes.ok) weatherlinkPichlberg.value = await pichlbergRes.json()
  } catch (e: any) {
    error.value = e?.message || 'Failed to load data'
    if (props.debug) log(`error: ${error.value}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (props.debug) log('Widget mounted')
  fetchAll()
  const t = setInterval(fetchAll, 2000)
  return () => clearInterval(t)
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
    <section v-else class="w-section">
      <header class="w-header">
        <h2 class="w-title">Windübersicht</h2>
        <p class="w-subtitle">Live-Messwerte aus Berg- und Tal (Sarntal).</p>
      </header>
      <div class="w-grid">
        <article
          v-for="station in STATIONS"
          :key="station.id"
          class="w-card"
        >
          <div class="w-card-head">
            <p class="w-station-name">{{ station.name }}</p>
            <div class="w-card-meta">
              <span
                v-if="getStationData(station)?.ts"
                class="w-time"
              >
                {{ new Date((getStationData(station)!.ts) * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
              <span v-if="LIVE_STATION_IDS.has(station.id)" class="w-live">● LIVE</span>
            </div>
          </div>
          <div v-if="getStationData(station)" class="w-card-body">
            <div class="w-winds">
              <span :class="windSpeedColor(getStationData(station)!.condition.wind_speed_last)">
                <strong>{{ getStationData(station)!.condition.wind_speed_last ?? '—' }}</strong> km/h
              </span>
              <span class="w-sep">·</span>
              <span :class="windSpeedColor(getStationData(station)!.condition.wind_speed_hi_last_10_min)">
                <strong>{{ getStationData(station)!.condition.wind_speed_hi_last_10_min ?? '—' }}</strong> km/h 10′ max
              </span>
              <span class="w-sep">·</span>
              <span class="w-avg">
                <strong>{{ getStationData(station)!.condition.wind_speed_avg_last_10_min ?? '—' }}</strong> km/h 10′ Ø
              </span>
            </div>
            <div class="w-row">
              <div class="w-dir-wrap">
                <span class="w-label">Richtung</span>
                <span class="w-dir">
                  {{ getStationData(station)!.condition.wind_dir_last != null ? degToDir(windDirDeg(getStationData(station)!.condition, station.id)) : '—' }}
                </span>
                <svg
                  v-if="getStationData(station)!.condition.wind_dir_last != null"
                  viewBox="0 0 24 12"
                  class="w-arrow"
                  :style="{ transform: `rotate(${(windDirDeg(getStationData(station)!.condition, station.id) + 180) % 360}deg)` }"
                >
                  <path
                    d="M12 0 L9 12 L12 11 L15 12 Z"
                    :fill="windSpeedColorHex(getStationData(station)!.condition.wind_speed_last ?? null)"
                    :stroke="windSpeedColorHex(getStationData(station)!.condition.wind_speed_hi_last_10_min ?? null)"
                    stroke-width="0.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div v-if="getStationData(station)!.condition.temp != null" class="w-temp">
                <span class="w-label">Temp</span>
                <span class="w-temp-val">{{ getStationData(station)!.condition.temp }} °C</span>
              </div>
            </div>
          </div>
          <p v-else class="w-no-data">Keine aktuellen Daten verfügbar.</p>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.w-root {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  color: #111827;
  line-height: 1.5;
  min-height: 120px;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  box-sizing: border-box;
}
.w-debug {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
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
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}
.w-loading,
.w-error {
  padding: 1rem;
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
  margin-bottom: 1rem;
  padding: 1rem 0;
}
.w-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}
.w-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}
.w-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 1024px) {
  .w-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.w-card {
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.w-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}
.w-station-name {
  font-weight: 500;
  margin: 0;
  color: #111827;
}
.w-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.w-time {
  font-size: 0.75rem;
  color: #6b7280;
  tabular-nums: 1;
}
.w-live {
  font-size: 0.75rem;
  font-weight: 500;
  color: #047857;
  background: #d1fae5;
  border: 1px solid #34d399;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}
.w-card-body {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f3f4f6;
}
.w-winds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
  margin-bottom: 0.75rem;
}
.w-sep {
  color: #d1d5db;
}
.w-avg {
  color: #4b5563;
}
.w-wind-gray { color: #6b7280; }
.w-wind-green { color: #16a34a; }
.w-wind-yellow { color: #eab308; }
.w-wind-orange { color: #ea580c; }
.w-wind-red { color: #dc2626; }
.w-wind-black { color: #000; }
.w-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.w-dir-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.w-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}
.w-dir {
  font-weight: 600;
  color: #111827;
}
.w-arrow {
  width: 2.25rem;
  height: 2.25rem;
}
.w-temp {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
}
.w-temp-val {
  font-weight: 600;
  color: #111827;
}
.w-no-data {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f3f4f6;
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
