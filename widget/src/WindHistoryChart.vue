<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { degToDir, formatWindSpeed, windSpeedBand, windSpeedColorHex } from '../../shared/windDisplay'

export type WindHistoryPoint = {
	ts: number
	max: number | null
	average: number | null
	dir?: number | null
}

const props = defineProps<{
	points: WindHistoryPoint[]
	from: number
	to: number
	stationName?: string
}>()

const SLOT_SEC = 10 * 60
const slotWidth = 30
const layout = { axisTop: 24, plotHeight: 230, axisGap: 6, arrowRow: 34, cellRow: 30, cellGap: 6, axisBottom: 24 }
const plotTop = layout.axisTop
const plotBottom = plotTop + layout.plotHeight
const arrowTop = plotBottom + layout.axisGap
const windTop = arrowTop + layout.arrowRow
const gustTop = windTop + layout.cellRow + layout.cellGap
const chartHeight = gustTop + layout.cellRow + layout.axisBottom

/** Plot bands, same thresholds as windSpeedBand(). Above the last band the dark plot background shows. */
const bands = [
	{ from: 0, to: 14, color: '#a3dc8f' },
	{ from: 14, to: 25, color: '#f3e98b' },
	{ from: 25, to: 30, color: '#efb877' },
	{ from: 30, to: 38, color: '#d9787a' },
]

const cellColors: Record<ReturnType<typeof windSpeedBand>, { bg: string; text: string }> = {
	gray: { bg: 'transparent', text: '#6b7280' },
	green: { bg: '#5cc75c', text: '#14301a' },
	yellow: { bg: '#f2e34c', text: '#3b3305' },
	orange: { bg: '#f5a23a', text: '#3f2404' },
	red: { bg: '#e2524a', text: '#ffffff' },
	black: { bg: '#1f1f1f', text: '#ffffff' },
}

type Slot = {
	ts: number
	x: number
	max: number | null
	average: number | null
	dir: number | null
}

const slots = computed<Slot[]>(() => {
	const start = Math.ceil(props.from / SLOT_SEC) * SLOT_SEC
	const end = Math.floor(props.to / SLOT_SEC) * SLOT_SEC
	const bySlot = new Map<number, WindHistoryPoint>()
	for (const point of props.points) bySlot.set(Math.floor(point.ts / SLOT_SEC) * SLOT_SEC, point)

	const result: Slot[] = []
	for (let ts = start, index = 0; ts <= end; ts += SLOT_SEC, index++) {
		const point = bySlot.get(ts)
		result.push({
			ts,
			x: (index + 0.5) * slotWidth,
			max: point?.max ?? null,
			average: point?.average ?? null,
			dir: point?.dir ?? null,
		})
	}
	return result
})

const chartWidth = computed(() => slots.value.length * slotWidth)

const maxSpeed = computed(() => {
	const highest = Math.max(0, ...props.points.flatMap((point) => [point.max ?? 0, point.average ?? 0]))
	return Math.max(60, Math.ceil((highest + 2) / 20) * 20)
})

const speedTicks = computed(() => {
	return Array.from({ length: maxSpeed.value / 20 + 1 }, (_, index) => index * 20)
})

function y(speed: number) {
	return plotBottom - (Math.min(speed, maxSpeed.value) / maxSpeed.value) * layout.plotHeight
}

const visibleBands = computed(() =>
	bands
		.filter((band) => band.from < maxSpeed.value)
		.map((band) => ({ ...band, y: y(band.to), height: y(band.from) - y(band.to) }))
)

/** SVG path that breaks at missing readings instead of bridging gaps. */
function linePath(key: 'max' | 'average') {
	let path = ''
	let drawing = false
	for (const slot of slots.value) {
		const speed = slot[key]
		if (speed == null) {
			drawing = false
			continue
		}
		path += `${drawing ? 'L' : 'M'}${slot.x},${y(speed)} `
		drawing = true
	}
	return path.trim()
}

const gustPath = computed(() => linePath('max'))
const averagePath = computed(() => linePath('average'))

const hourTicks = computed(() =>
	slots.value.filter((slot) => slot.ts % 3600 === 0).map((slot) => ({ ts: slot.ts, x: slot.x - slotWidth / 2 }))
)

/** Highest gust per clock hour, shown when it is a local peak. */
const peakLabels = computed(() => {
	const byHour = new Map<number, { slot: Slot; index: number }>()
	slots.value.forEach((slot, index) => {
		if (slot.max == null) return
		const hour = Math.floor(slot.ts / 3600)
		const current = byHour.get(hour)
		if (!current || slot.max > (current.slot.max ?? 0)) byHour.set(hour, { slot, index })
	})
	return [...byHour.values()]
		.filter(({ slot, index }) => {
			const previous = slots.value[index - 1]?.max ?? -1
			const next = slots.value[index + 1]?.max ?? -1
			return slot.max! >= previous && slot.max! >= next
		})
		.map(({ slot }) => slot)
})

function formatHour(ts: number) {
	return new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })
}

function slotTitle(slot: Slot) {
	const direction = slot.dir == null ? '—' : degToDir(slot.dir)
	return `${formatHour(slot.ts)} · Wind ${formatWindSpeed(slot.average)} · Böen ${formatWindSpeed(slot.max)} km/h · ${direction}`
}

const scroller = ref<HTMLElement | null>(null)

function scrollToLatest() {
	void nextTick(() => {
		if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth
	})
}

onMounted(scrollToLatest)
watch(() => props.points, scrollToLatest)
</script>

<template>
	<div class="w-history">
		<header class="w-history-head">
			<div>
				<h3 class="w-history-title">Windverlauf – letzte 24 Stunden</h3>
				<p class="w-history-subtitle">{{ stationName ?? 'Pichlberg' }} · km/h · 10-Minuten-Werte</p>
			</div>
			<div class="w-history-legend">
				<span class="w-history-legend-item">
					<span class="w-history-swatch w-history-swatch-gust" aria-hidden="true"></span>
					Böen (10′ max)
				</span>
				<span class="w-history-legend-item">
					<span class="w-history-swatch" aria-hidden="true"></span>
					Wind (10′ Ø)
				</span>
			</div>
		</header>

		<p v-if="points.length === 0" class="w-history-message">
			Für die letzten 24 Stunden sind keine Windmesswerte vorhanden.
		</p>
		<div v-else class="w-history-body">
			<div ref="scroller" class="w-history-scroll">
				<svg
					:width="chartWidth"
					:height="chartHeight"
					:viewBox="`0 0 ${chartWidth} ${chartHeight}`"
					class="w-history-svg"
					role="img"
					aria-label="Winddiagramm mit Böen, Durchschnittswind und Windrichtung der letzten 24 Stunden"
				>
					<rect x="0" :y="plotTop" :width="chartWidth" :height="layout.plotHeight" fill="#616161" />
					<rect
						v-for="band in visibleBands"
						:key="band.from"
						x="0"
						:y="band.y"
						:width="chartWidth"
						:height="band.height"
						:fill="band.color"
					/>
					<line
						v-for="tick in speedTicks"
						:key="`grid-${tick}`"
						x1="0"
						:x2="chartWidth"
						:y1="y(tick)"
						:y2="y(tick)"
						stroke="rgba(0,0,0,0.22)"
					/>

					<g v-for="tick in hourTicks" :key="tick.ts">
						<line :x1="tick.x" :x2="tick.x" :y1="plotTop - 4" :y2="chartHeight - layout.axisBottom + 4" stroke="rgba(0,0,0,0.25)" />
						<text :x="tick.x" :y="plotTop - 8" text-anchor="middle" font-size="12" fill="#374151">{{ formatHour(tick.ts) }}</text>
						<text :x="tick.x" :y="chartHeight - 6" text-anchor="middle" font-size="12" fill="#374151">{{ formatHour(tick.ts) }}</text>
					</g>

					<path :d="averagePath" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="round" />
					<path :d="gustPath" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round" />
					<template v-for="slot in slots" :key="`dots-${slot.ts}`">
						<circle v-if="slot.average != null" :cx="slot.x" :cy="y(slot.average)" r="2.4" fill="#000" />
						<circle v-if="slot.max != null" :cx="slot.x" :cy="y(slot.max)" r="3.2" fill="#000" />
					</template>
					<text
						v-for="slot in peakLabels"
						:key="`peak-${slot.ts}`"
						:x="slot.x"
						:y="y(slot.max!) - 9"
						text-anchor="middle"
						font-size="13"
						font-weight="700"
						fill="#000"
						stroke="rgba(255,255,255,0.85)"
						stroke-width="3"
						paint-order="stroke"
					>{{ formatWindSpeed(slot.max) }}</text>

					<g v-for="slot in slots" :key="slot.ts">
						<g
							v-if="slot.dir != null"
							:transform="`translate(${slot.x} ${arrowTop + layout.arrowRow / 2}) rotate(${(slot.dir + 180) % 360})`"
						>
							<path
								d="M0 -12 L-8 12 L0 8 L8 12 Z"
								:fill="windSpeedColorHex(slot.average)"
								:stroke="windSpeedColorHex(slot.max)"
								stroke-width="1.6"
								stroke-linejoin="round"
							/>
						</g>
						<template v-for="row in [{ top: windTop, speed: slot.average }, { top: gustTop, speed: slot.max }]" :key="row.top">
							<template v-if="row.speed != null">
								<rect
									:x="slot.x - slotWidth / 2 + 1"
									:y="row.top"
									:width="slotWidth - 2"
									:height="layout.cellRow"
									:fill="cellColors[windSpeedBand(row.speed)].bg"
								/>
								<text
									:x="slot.x"
									:y="row.top + layout.cellRow / 2 + 5"
									text-anchor="middle"
									font-size="14"
									class="w-history-cell"
									:fill="cellColors[windSpeedBand(row.speed)].text"
								>{{ formatWindSpeed(row.speed) }}</text>
							</template>
						</template>
						<rect
							:x="slot.x - slotWidth / 2"
							:y="plotTop"
							:width="slotWidth"
							:height="chartHeight - plotTop - layout.axisBottom"
							fill="transparent"
						>
							<title>{{ slotTitle(slot) }}</title>
						</rect>
					</g>
				</svg>
			</div>

			<svg :width="52" :height="chartHeight" class="w-history-axis" aria-hidden="true">
				<text
					v-for="tick in speedTicks"
					:key="`label-${tick}`"
					x="6"
					:y="y(tick) + 4"
					font-size="12"
					fill="#374151"
				>{{ tick }}</text>
				<text x="6" :y="plotBottom + 18" font-size="12" fill="#374151">km/h</text>
				<text x="6" :y="windTop + layout.cellRow / 2 + 5" font-size="13" fill="#111827">Wind</text>
				<text x="6" :y="gustTop + layout.cellRow / 2 + 5" font-size="13" fill="#111827">Böen</text>
			</svg>
		</div>
	</div>
</template>
