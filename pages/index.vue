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
const { data: windStationsData, refresh: refreshWindStations } = await useFetch<Record<string, { station_id: string; ts: number; condition: Partial<ICondition> }>>('/api/wind-stations')
const { data: southTyrolData, refresh: refreshSouthTyrol } = await useFetch<Record<string, INormalizedSouthTyrolStation>>(
    `/api/southtyrol/sensors?station_codes=${SOUTH_TIROL_CODES}`
)
const { data: foehnData } = await useFetch<{ contents?: Array<{ imageUrl?: string }> }>('/api/southtyrol/foehn?lang=de')
const { data: pwsData, refresh: refreshPws } = await useFetch<{ ts: number; condition: Partial<ICondition> }>('/api/pws/observations?stationId=ISARNT29')
const { data: weatherlinkSatteleData, refresh: refreshWeatherlinkSattele } = await useFetch<{ ts: number; condition: Partial<ICondition> }>('/api/weatherlink/current?stationId=92575')

const summ = 270
const weatherData = ref(<IWeatherData>{})
const selectedStationId = ref('33570')
const degrees = ref('-135deg')
const degreesMax = ref('-135deg')
const direction = ref('0deg')
const directionScalar = ref('0deg')

function degToDir(deg: number): string {
    const number = Math.round(deg / 22.5 + 0.5)
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    return directions[number % 16]
}

function getStationData(station: IStationConfig): { ts: number; condition: Partial<ICondition> } | null {
	if (station.source === 'weatherlink' && windStationsData.value?.[station.station_id!]) {
		const d = windStationsData.value[station.station_id!]
		return { ts: d.ts, condition: d.condition }
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
		return null
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
        return weatherData.value?.ts ?? 0
    const data = getStationData(station)
    return data?.ts ?? 0
})

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
    <section class="windinfo-section">
        <h3 class="text-lg font-semibold mb-2">Windwerte</h3>
        <div class="windinfo">
            <div v-for="station in STATIONS" :key="station.id" class="wind-item" :class="{ 'wind-item--selected': selectedStationId === station.id }" @click="selectedStationId = station.id">
                <div class="label">
                    <span class="label__name">{{ station.name }}</span>
                    <span v-if="getStationData(station)?.ts" class="label__time">{{ new Date(getStationData(station)!.ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}</span>
                    <span v-if="LIVE_STATION_IDS.has(station.id)" class="live-badge" title="Live"><span class="live-badge__dot"></span> LIVE</span>
                </div>
                <div class="wind" v-if="getStationData(station)">
                    <span class="v-item"><b>{{ getStationData(station)!.condition.wind_speed_last ?? '—' }}</b> km/h</span>
                    <span class="pipe">|</span>
                    <span class="v-item">{{ getStationData(station)!.condition.wind_speed_hi_last_10_min ?? '—' }} km/h 10' max</span>
                    <span class="pipe">|</span>
                    <span class="v-item">{{ getStationData(station)!.condition.wind_speed_avg_last_10_min ?? '—' }} km/h 10' Ø</span>
                    <span class="v-item"><b>{{ getStationData(station)!.condition.wind_dir_last != null ? degToDir(windDirDeg(getStationData(station)!.condition, station.id)) : '—' }}</b></span>
                </div>
                <div class="temp" v-if="getStationData(station)"><b>{{ getStationData(station)!.condition.temp ?? '—' }} °C</b></div>
            </div>
        </div>
    </section>

    <section v-if="foehnData?.contents?.[0]?.imageUrl" class="foehn-section mt-4">
        <h3 class="text-lg font-semibold mb-2">Föhndiagramm</h3>
        <div class="foehn-value">
            <img :src="foehnData.contents[0].imageUrl" alt="Föhndiagramm" class="max-w-full h-auto" />
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
    <div class="outer flex py-6" v-if="selectedCondition">
        <div class="gauge-cell gauge-cell--now">
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
                        <!-- Wind arrow: tip up, base at center so it pivots correctly -->
                        <path d="M12 0 L9 12 L12 11 L15 12 Z" fill="#dc2626" stroke="#b91c1c" stroke-width="0.5" stroke-linejoin="round" />
                    </svg>
                </div>
                <div class="wind-arrow wind-arrow--scalar" :style="{ transform: `translate(-50%, -50%) rotate(${directionScalar})` }">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="wind-arrow__svg">
                        <path d="M12 0 L9 12 L12 11 L15 12 Z" fill="#dc2626" stroke="#b91c1c" stroke-width="0.5" stroke-linejoin="round" opacity="0.4" />
                    </svg>
                </div>
            </div>
        </div>
        <!-- <div class="gauge-cell gauge-cell--old">
            <div class="gauge-label">
                <span class="gauge-label__arrow" aria-hidden="true">→</span>
                <span>Alt</span>
            </div>
            <div class="speed">
            <div class="speed__wheel">
                <div class="speed__tick">
                    <div class="tick" value="0"></div>
                    <div class="tick" value="5"></div>
                    <div class="tick" value="10"></div>
                    <div class="tick" value="15"></div>
                    <div class="tick" value="20"></div>
                    <div class="tick" value="25"></div>
                    <div class="tick" value="30"></div>
                    <div class="tick" value="35"></div>
                    <div class="tick" value="40"></div>
                    <div class="tick" value="45"></div>
                    <div class="tick" value="50"></div>
                    <div class="tick" value="55"></div>
                    <div class="tick" value="60"></div>
                    <div class="tick" value="65"></div>
                    <div class="tick" value="70"></div>
                    <div class="tick" value="75"></div>
                    <div class="tick" value="80"></div>
                    <div class="tick" value="85"></div>
                    <div class="tick" value="90"></div>
                    <div class="tick" value="95"></div>
                    <div class="tick" value="100"></div>
                </div>
                <div class="pointer pointer-current"></div>
                <div class="pointer pointer-max"></div>
                <div class="endpoint"></div>
            </div>
        </div> -->
    </div>
</template>
<style lang="less">
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

.outer {
    display: flex;
    flex-wrap: nowrap;
    gap: 1rem;
    width: 100%;
}

.gauge-cell {
    min-width: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 0.5rem;
    padding: 1rem;
}

.gauge-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
}

.gauge-label__arrow {
    font-size: 1rem;
    color: #6b7280;
}

.outer .gauge-cell .direction,
.outer .gauge-cell .speed {
    max-width: 300px;
    width: 100%;

    svg {
        width: 100%;
        height: auto;
        max-height: 300px;
    }
}

.speed {
    position: relative;
    display: flex;
}

.direction {
    width: 300px;
    position: relative;

    .direction__wheel {
        z-index: 3;
        width: 100%;
    }

    .wind-arrow {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 56%;
        height: 56%;
        pointer-events: none;
        z-index: 5;
        transition: transform 1.5s ease-out;
    }

    .wind-arrow--scalar {
        z-index: 4;
    }

    .wind-arrow__svg {
        width: 100%;
        height: 100%;
        display: block;
    }
}

.windinfo-section {
    margin-bottom: 1.5rem;
}

.windinfo {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.wind-item {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    width: 100%;
    cursor: pointer;
}

.wind-item:hover {
    background: #f3f4f6;
}

.wind-item--selected {
    border-color: #3b82f6;
    background: #eff6ff;
}

.wind-item .label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    justify-content: flex-end;
}

.wind-item .label__name {
    margin-right: auto;
}

.wind-item .label__time {
    color: #6b7280;
    font-size: 0.875rem;
}

.wind-item .label .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #16a34a;
    font-size: 0.75rem;
    font-weight: 600;
    animation: live-badge-blink 2s ease-in-out infinite;
}

.wind-item .label .live-badge__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #16a34a;
    flex-shrink: 0;
}

@keyframes live-badge-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

.wind-item .wind,
.wind-item .temp {
    font-size: 0.875rem;
    margin-top: 0.25rem;
}

.wind-item .wind {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.25rem;
}

.wind-item .pipe {
    margin: 0 0.25rem;
    color: #9ca3af;
}
.windinfo {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.wind-item {
    width: calc(50% - 0.25rem);
    min-width: 0;
}
@media (max-width: 1023px) {


    .wind-item .wind .v-item {
        display: block;
        width: 100%;
    }

    .wind-item .wind .pipe {
        display: none;
    }
}


.speed__tick {
    display: flex;
    gap: 1px;
}

.tick {
    transform-origin: bottom;
    position: absolute;
    background: linear-gradient(to top, transparent 90%, white 90%);
    height: 140px;
    width: 2px;
    top: 10px;
    left: 50%;
    transform: rotate(var(--angle)) rotateZ(-145.5deg);
}

.tick:nth-child(odd)::before {
    position: absolute;
    content: attr(value) '';
    color: #fff;
    left: -8px;
    top: 20px;
    z-index: 11;
    transform: rotate(var(--position-number));
}

each(range(22), {
    .tick:nth-child(@{value}) {
        --angle: calc(270deg / 20.5 * @value);
        --position-number: calc(145deg + (-13.2deg * @value));
    }

}) .speed .pointer {
    transition: transform 2s ease-out;
    position: absolute;
    left: 50%;
    top: 50%;
    margin-left: -10px;
    margin-top: -170px;
    width: 20px;
    height: 170px;
    background: #e66958;
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    transform-origin: 10px 170px;

    &.pointer-current {
        transform: rotate(v-bind(degrees));
    }

    &.pointer-max {
        opacity: 0.4;
        transform: rotate(v-bind(degreesMax));
    }
}

.speed .pointer::before {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    background: #f2f3f3;
    border-radius: 50%;
    bottom: -6px;
    left: 50%;
    margin-left: -6px;
}

.endpoint {
    position: absolute;
    width: 7px;
    height: 7px;
    background: #f2f3f3;
    top: 225px;
    left: 235px;
    border-radius: 50%;
}

// LAYOUT mobile
@media (max-width: 1023px) {
    .outer {
        flex-direction: row;
        align-items: center;

        .direction {
            margin: 3rem 0;
        }
    }

    .temperatures {
        flex-direction: column;
    }
}
</style>
