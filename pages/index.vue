<script setup lang="ts">
import { useMeasurement } from '~/composables/measurment'
import type { IWeatherData, IMeasurement, IStationConfig, ICondition, INormalizedSouthTyrolStation } from '~/types'

/** Station IDs that have live data (real-time); show green LIVE indicator. */
const LIVE_STATION_IDS = new Set(['33570', 'ISARNT29'])

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

const SOUTH_TIROL_CODES = STATIONS.filter((s) => s.source === 'southtyrol').map((s) => s.station_code!).join(',')

const { data, refresh } = await useFetch('/api/measurement')
console.log(data.value)
const { data: windStationsData, refresh: refreshWindStations } = await useFetch<Record<string, { station_id: string; ts: number; condition: Partial<ICondition> }>>('/api/wind-stations')
const { data: southTyrolData, refresh: refreshSouthTyrol } = await useFetch<Record<string, INormalizedSouthTyrolStation>>(
    `/api/southtyrol/sensors?station_codes=${SOUTH_TIROL_CODES}`
)
const { data: foehnData } = await useFetch<{ contents?: Array<{ imageUrl?: string }> }>('/api/southtyrol/foehn?lang=de')
const { data: pwsData, refresh: refreshPws } = await useFetch<{ ts: number; condition: Partial<ICondition> }>('/api/pws/observations?stationId=ISARNT29')
const { data: weatherlinkSatteleData, refresh: refreshWeatherlinkSattele } = await useFetch<{ ts: number; condition: Partial<ICondition> }>('/api/weatherlink/current?stationId=92575')
const { data: weatherlinkPichlbergData } = await useFetch<{ ts: number; condition: Partial<ICondition> }>('/api/weatherlink/current?stationId=33570')

const summ = 270
const weatherData = ref(<IWeatherData>{})
const selectedStationId = ref('33570')
const degrees = ref('-135deg')
const degreesMax = ref('-135deg')
const direction = ref('0deg')
const directionScalar = ref('0deg')

function degToDir(deg: number): string {
    const number = Math.round(deg / 22.5 + 0.5)
    const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    return directions[number % 16]
}

/** Tailwind text color class for wind speed: green <= 14, yellow 15–25, orange 26–30, red 31–38, black > 38 km/h. */
function windSpeedColor(speed: number | null | undefined): string {
    if (speed == null) return 'text-gray-500'
    if (speed <= 14) return 'text-green-600'
    if (speed <= 25) return 'text-yellow-500'
    if (speed <= 30) return 'text-orange-600'
    if (speed <= 38) return 'text-red-600'
    return 'text-black'
}

/** Hex color for wind speed arrows, same bands as windSpeedColor. */
function windSpeedColorHex(speed: number | null | undefined): string {
    if (speed == null) return '#6b7280' // gray-500
    if (speed <= 14) return '#16a34a' // green-600
    if (speed <= 25) return '#eab308' // yellow-500
    if (speed <= 30) return '#ea580c' // orange-600
    if (speed <= 38) return '#dc2626' // red-600
    return '#000000'
}

function getStationData(station: IStationConfig): { ts: number; condition: Partial<ICondition> } | null {
	if (station.source === 'weatherlink' && windStationsData.value?.[station.station_id!]) {
		const d = windStationsData.value[station.station_id!]
		return { ts: d.ts, condition: d.condition }
	}
	// Pichlberg (33570): fallback to WeatherLink API when DB/wind-stations is empty (e.g. Cloudflare)
	if (station.source === 'weatherlink' && station.station_id === '33570' && weatherlinkPichlbergData.value && 'ts' in weatherlinkPichlbergData.value && 'condition' in weatherlinkPichlbergData.value) {
		return { ts: weatherlinkPichlbergData.value.ts, condition: weatherlinkPichlbergData.value.condition }
	}
	if (station.source === 'weatherlink' && station.station_id === '92575') {
		// #region agent log
		
		// #endregion
		if (weatherlinkSatteleData.value && 'ts' in weatherlinkSatteleData.value && 'condition' in weatherlinkSatteleData.value) {
			return { ts: weatherlinkSatteleData.value.ts, condition: weatherlinkSatteleData.value.condition }
		}
	}
	if (station.source === 'pws' && station.station_id === 'ISARNT29' && pwsData.value && 'ts' in pwsData.value && 'condition' in pwsData.value) {
		return { ts: pwsData.value.ts, condition: pwsData.value.condition }
	}
	if (station.source === 'southtyrol' && southTyrolData.value?.[station.station_code!]) {
		const d = southTyrolData.value[station.station_code!]
		return { ts: d.ts, condition: d as Partial<ICondition> }
	}
	return null
}

const selectedCondition = computed(() => {
	const station = STATIONS.find((s) => s.id === selectedStationId.value)
	if (!station) return null
	if (station.source === 'weatherlink' && station.station_id === '33570') {
		if (weatherData.value?.conditions?.[0]) return weatherData.value.conditions[0]
		// Fallback to WeatherLink API when DB/measurement is empty (e.g. Cloudflare)
		const fallback = getStationData(station)
		return fallback?.condition ?? null
	}
	const data = getStationData(station)
	return data?.condition ?? null
})

/** Pichlberg (33570) wind direction is 180° off; correct for display. */
function windDirDeg(cond: Partial<ICondition> | null, stationId: string): number {
	const raw = cond?.wind_dir_last ?? 0
	if (stationId === '33570') return (raw + 180) % 360
	return raw
}
function windDirScalarDeg(cond: Partial<ICondition> | null, stationId: string): number {
	const raw = cond?.wind_dir_scalar_avg_last_10_min ?? cond?.wind_dir_last ?? 0
	if (stationId === '33570') return (raw + 180) % 360
	return raw
}

const selectedTs = computed(() => {
    const station = STATIONS.find((s) => s.id === selectedStationId.value)
    if (!station) return 0
    if (station.source === 'weatherlink' && station.station_id === '33570')
        return weatherData.value?.ts ?? getStationData(station)?.ts ?? 0
    const data = getStationData(station)
    return data?.ts ?? 0
})

const selectedStationName = computed(() =>
    STATIONS.find((s) => s.id === selectedStationId.value)?.name ?? '–'
)

function update() {
	weatherData.value = useMeasurement(<IMeasurement>data.value)
	const cond = selectedCondition.value
	const sid = selectedStationId.value
	if (cond) {
		const dir = windDirDeg(cond, sid)
		const dirScalar = windDirScalarDeg(cond, sid)
		// Arrow is 180° off: rotate so it shows wind-from direction correctly
		direction.value = (dir + 180) % 360 + 'deg'
		directionScalar.value = (dirScalar + 180) % 360 + 'deg'
		degrees.value = (summ / 100) * (cond.wind_speed_last ?? 0) - 135 + 'deg'
		degreesMax.value = (summ / 100) * (cond.wind_speed_hi_last_10_min ?? 0) - 135 + 'deg'
	}
}

await refresh()
await update()
if (southTyrolData.value === null) await refreshSouthTyrol()
if (windStationsData.value === null) await refreshWindStations()

watch(selectedStationId, () => update(), { immediate: false })

onMounted(() => {
    setInterval(async () => {
        await refresh()
        await refreshWindStations()
        await update()
    }, 2000)
	setInterval(() => {
		refreshSouthTyrol()
		refreshPws()
		refreshWeatherlinkSattele()
	}, 60 * 1000)
})

</script>
<template>
    <section class="space-y-6">
        <!-- Section header with prominent current station name -->
        <header class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div class="space-y-1">
                    <h2 class="text-lg font-semibold tracking-tight text-gray-900">
                        Windübersicht
                    </h2>
                    <p class="text-sm text-gray-500">
                        Live&nbsp;Messwerte aus Berg- und Talstationen rund um das Sarntal.
                    </p>
                </div>
            </div>
        </header>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article
                v-for="station in STATIONS"
                :key="station.id"
                class="cursor-pointer rounded-xl border-2 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow"
                :class="selectedStationId === station.id ? 'border-sky-500 ring-2 ring-sky-200' : 'border-gray-200'"
                @click="selectedStationId = station.id"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <p class="text-base font-medium text-gray-900">
                            {{ station.name }}
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <span
                            v-if="getStationData(station)?.ts"
                            class="text-xs tabular-nums text-gray-500"
                        >
                            {{ new Date(getStationData(station)!.ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}
                        </span>
                        <span
                            v-if="LIVE_STATION_IDS.has(station.id)"
                            class="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        >
                            <span class="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            LIVE
                        </span>
                    </div>
                </div>

                <div v-if="getStationData(station)" class="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base text-gray-600">
                        <span :class="windSpeedColor(getStationData(station)!.condition.wind_speed_last)">
                            <span class="font-semibold">{{ getStationData(station)!.condition.wind_speed_last ?? '—' }}</span> km/h
                        </span>
                        <span class="text-gray-400">aktuell</span>
                        <span class="hidden text-gray-300 sm:inline">·</span>
                        <span :class="windSpeedColor(getStationData(station)!.condition.wind_speed_hi_last_10_min)">
                            <span class="font-semibold">{{ getStationData(station)!.condition.wind_speed_hi_last_10_min ?? '—' }}</span> km/h 10′ max
                        </span>
                        <span class="hidden text-gray-300 sm:inline">·</span>
                        <span class="text-gray-600">
                            <span>{{ getStationData(station)!.condition.wind_speed_avg_last_10_min ?? '—' }}</span> km/h 10′ Ø
                        </span>
                    </div>

                    <div class="flex items-center justify-between text-base text-gray-600">
                        <div class="flex items-center gap-2">
                            <div class="flex items-baseline gap-1.5">
                                <span class="text-xs uppercase tracking-wider text-gray-500">
                                    Richtung
                                </span>
                                <span class="font-semibold text-gray-900">
                                    {{
                                        getStationData(station)!.condition.wind_dir_last != null
                                            ? degToDir(windDirDeg(getStationData(station)!.condition, station.id))
                                            : '—'
                                    }}
                                </span>
                            </div>
                            <svg
                                v-if="getStationData(station) && getStationData(station)!.condition.wind_dir_last != null"
                                viewBox="0 0 24 12"
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-9 w-9"
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
                        <div v-if="getStationData(station)!.condition.temp != null" class="flex items-baseline gap-1.5">
                            <span class="text-xs uppercase tracking-wider text-gray-500">
                                Temp
                            </span>
                            <span class="font-semibold text-gray-900">
                                {{ getStationData(station)!.condition.temp }} °C
                            </span>
                        </div>
                    </div>
                </div>

                <p v-else class="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
                    Keine aktuellen Daten verfügbar.
                </p>
            </article>
        </div>
    </section>

    <section v-if="foehnData?.contents?.[0]?.imageUrl" class="mt-8">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <header class="mb-4">
                <h3 class="text-base font-semibold text-gray-900">
                    Föhndiagramm
                </h3>
                <p class="mt-0.5 text-sm text-gray-500">
                    Darstellung der aktuellen Föhnsituation (Landeswetterdienst Südtirol).
                </p>
            </header>
            <div class="flex justify-center rounded-lg border border-gray-200 bg-gray-50 p-4">
                <img
                    :src="foehnData.contents[0].imageUrl"
                    alt="Föhndiagramm"
                    class="max-h-[420px] w-full max-w-3xl object-contain"
                />
            </div>
        </div>
    </section>

    <!-- <div v-if="selectedCondition" class="detail-section">
        <div class="py-1.5">
            {{ selectedTs ? new Date(selectedTs * 1000).toLocaleString() : '' }}
        </div>
        <div class="py-1.5">
            Aktuelle Wind: <strong>{{ selectedCondition.wind_speed_last ?? '—' }}</strong> km/h
        </div>
        <div class="py-1.5">
            Durchschnitt Wind 10min: <strong>{{ selectedCondition.wind_speed_avg_last_10_min ?? '—' }}</strong> km/h
        </div>
        <div class="py-1.5">
            Höchstwert Wind 10min: <strong>{{ selectedCondition.wind_speed_hi_last_10_min ?? '—' }}</strong> km/h
        </div>
        <div class="py-1.5">
            Temperatur: <strong>{{ selectedCondition.temp ?? '—' }}</strong> °C
        </div>
        <div class="py-1.5" v-if="selectedCondition.hum != null">
            Feuchtigkeit: <strong>{{ selectedCondition.hum }}</strong> %
        </div>
        <div class="py-1.5" v-if="selectedCondition.wet_bulb != null">
            Feuchtkugel: <strong>{{ selectedCondition.wet_bulb }}</strong> °C
        </div>
    </div> -->
    <section v-if="selectedCondition" class="mt-8">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start">
            <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <header class="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p class="text-xs uppercase tracking-wider text-gray-500">
                            Aktuelle Station
                        </p>
                        <h3 class="text-lg font-semibold text-gray-900">
                            {{ selectedStationName }}
                        </h3>
                        <p class="mt-0.5 text-xs uppercase tracking-wider text-gray-500">
                            Windrichtung &amp; Skalar (10′)
                        </p>
                    </div>
                    <span
                        v-if="selectedTs"
                        class="text-sm tabular-nums text-gray-500"
                    >
                        {{ new Date(selectedTs * 1000).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}
                    </span>
                </header>

                <div class="flex justify-center">
                    <div class="direction">
                        <div class="direction__wheel">
                    <svg viewBox="0 0 800 800" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <clipPath id="m">
                            <path id="msk" d="m0-380 45,270 255,-190z m0,0 -45,270 -255,-190z m0,760 -45,-270 -255,190z m0,0 45,-270 255,190z" />
                            <use xlink:href="#msk" transform="rotate(90)" />
                        </clipPath>
                        <g transform="translate(400 400)" fill="none" stroke="#000">
                            <circle r="300" />
                            <g id="sca" stroke-linecap="round">
                                <path d="M0,-300v-40 M0,300v40" stroke-width="2" />
                                <path id="a" d="M0,-300v-20 M0,300v20" />
                                <use xlink:href="#a" transform="rotate(5)" />
                                <use xlink:href="#a" transform="rotate(10)" />
                                <use xlink:href="#a" transform="rotate(15)" />
                                <use xlink:href="#a" transform="rotate(20)" />
                                <use xlink:href="#a" transform="rotate(25)" />
                                <use xlink:href="#a" transform="rotate(30)" />
                                <use xlink:href="#a" transform="rotate(35)" />
                                <use xlink:href="#a" transform="rotate(40)" />
                            </g>
                            <use xlink:href="#sca" transform="rotate(45)" />
                            <use xlink:href="#sca" transform="rotate(90)" />
                            <use xlink:href="#sca" transform="rotate(135)" />
                            <g fill="#000" stroke="#000" style="opacity: 0.23">
                                <path d="m0,-65 155-90 -90,155 90,155 -155-90 -155,90 90,-155 -90,-155z" fill="#fff" />
                                <path d="m0,0 0-65 155-90 -310,310 155-90 0-65 -65,0 -90-155 310,310 -90-155z" />
                                <path d="m45-45 -45-255 -45,255 -255,45 255,45 45,255 45-255 255-45z" fill="#fff" />
                                <path d="m0,0 -45-45 45-255 0,600 45-255 -45-45 -300,0 255,45 90-90 255,45z" />
                            </g>
                            <circle clip-path="url(#m)" stroke="#ccc" stroke-width="30" r="220" />
                            <g font-family="Sans" font-size="18" text-anchor="middle" fill="#000" stroke="none">
                                <text x="0" y="-380">
                                    N
                                    <tspan x="0" dy="22.5">360°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(45)">
                                    NO
                                    <tspan x="0" dy="22.5">45°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(90)">
                                    O
                                    <tspan x="0" dy="22.5">90°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(135)">
                                    SO
                                    <tspan x="0" dy="22.5">135°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(180)">
                                    S
                                    <tspan x="0" dy="22.5">180°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(225)">
                                    SW
                                    <tspan x="0" dy="22.5">225°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(270)">
                                    W
                                    <tspan x="0" dy="22.5">270°</tspan>
                                </text>
                                <text x="0" y="-380" transform="rotate(315)">
                                    NW
                                    <tspan x="0" dy="22.5">315°</tspan>
                                </text>
                            </g>
                        </g>
                    </svg>
                </div>
                <div class="wind-arrow wind-arrow--current" :style="{ transform: `translate(-50%, -50%) rotate(${direction})` }">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="wind-arrow__svg">
                        <path
                            d="M12 0 L9 12 L12 11 L15 12 Z"
                            :fill="windSpeedColorHex(selectedCondition?.wind_speed_last ?? null)"
                            :stroke="windSpeedColorHex(selectedCondition?.wind_speed_hi_last_10_min ?? null)"
                            stroke-width="0.5"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <div class="wind-arrow wind-arrow--scalar" :style="{ transform: `translate(-50%, -50%) rotate(${directionScalar})` }">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="wind-arrow__svg">
                        <path
                            d="M12 0 L9 12 L12 11 L15 12 Z"
                            :fill="windSpeedColorHex(selectedCondition?.wind_speed_avg_last_10_min ?? null)"
                            :stroke="windSpeedColorHex(selectedCondition?.wind_speed_hi_last_10_min ?? null)"
                            stroke-width="0.5"
                            stroke-linejoin="round"
                            opacity="0.4"
                        />
                    </svg>
                </div>
                    </div>
                </div>
            </div>

            <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <header class="mb-4">
                    <h3 class="text-base font-semibold text-gray-900">
                        Detailwerte
                    </h3>
                    <p class="mt-0.5 text-sm text-gray-500">
                        {{ selectedStationName }}
                    </p>
                </header>

                <dl class="grid grid-cols-2 gap-4 text-sm">
                    <div class="space-y-0.5 rounded-lg bg-gray-50 p-3">
                        <dt class="text-xs uppercase tracking-wider text-gray-500">
                            Aktuell
                        </dt>
                        <dd :class="['font-semibold', windSpeedColor(selectedCondition.wind_speed_last)]">
                            {{ selectedCondition.wind_speed_last ?? '—' }} km/h
                        </dd>
                    </div>
                    <div class="space-y-0.5 rounded-lg bg-gray-50 p-3">
                        <dt class="text-xs uppercase tracking-wider text-gray-500">
                            10′ Ø
                        </dt>
                        <dd class="font-semibold text-gray-900">
                            {{ selectedCondition.wind_speed_avg_last_10_min ?? '—' }} km/h
                        </dd>
                    </div>
                    <div class="space-y-0.5 rounded-lg bg-gray-50 p-3">
                        <dt class="text-xs uppercase tracking-wider text-gray-500">
                            10′ max
                        </dt>
                        <dd :class="['font-semibold', windSpeedColor(selectedCondition.wind_speed_hi_last_10_min)]">
                            {{ selectedCondition.wind_speed_hi_last_10_min ?? '—' }} km/h
                        </dd>
                    </div>
                    <div class="space-y-0.5 rounded-lg bg-gray-50 p-3">
                        <dt class="text-xs uppercase tracking-wider text-gray-500">
                            Temperatur
                        </dt>
                        <dd class="font-semibold text-gray-900">
                            {{ selectedCondition.temp ?? '—' }} °C
                        </dd>
                    </div>
                    <div v-if="selectedCondition.hum != null" class="space-y-0.5 rounded-lg bg-gray-50 p-3">
                        <dt class="text-xs uppercase tracking-wider text-gray-500">
                            Feuchte
                        </dt>
                        <dd class="font-semibold text-gray-900">
                            {{ selectedCondition.hum }} %
                        </dd>
                    </div>
                    <div v-if="selectedCondition.wet_bulb != null" class="space-y-0.5 rounded-lg bg-gray-50 p-3">
                        <dt class="text-xs uppercase tracking-wider text-gray-500">
                            Feuchtkugel
                        </dt>
                        <dd class="font-semibold text-gray-900">
                            {{ selectedCondition.wet_bulb }} °C
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    </section>
</template>
<style scoped>
.direction {
  width: min(320px, 100%);
  position: relative;
}

.direction__wheel svg {
  width: 100%;
  height: auto;
  max-height: 320px;
}

.wind-arrow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 56%;
  height: 56%;
  pointer-events: none;
  z-index: 5;
  transition: transform 1.4s cubic-bezier(0.19, 1, 0.22, 1);
}

.wind-arrow--scalar {
  z-index: 4;
}

.wind-arrow__svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
