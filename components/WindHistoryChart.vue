<script setup lang="ts">
import { computed } from 'vue'
import { formatWindSpeed, windSpeedColor, windSpeedColorHex } from '~/shared/windDisplay'

export type WindHistoryPoint = {
	ts: number
	max: number | null
	average: number | null
}

const props = defineProps<{
	points: WindHistoryPoint[]
	from: number
	to: number
}>()

const chart = { width: 720, height: 250, left: 46, right: 12, top: 16, bottom: 34 }
const plotWidth = chart.width - chart.left - chart.right
const plotHeight = chart.height - chart.top - chart.bottom

const maxSpeed = computed(() => {
	const highest = Math.max(0, ...props.points.flatMap((point) => [point.max ?? 0, point.average ?? 0]))
	return Math.max(10, Math.ceil(highest / 10) * 10)
})

const plottedPoints = computed(() => {
	const duration = Math.max(1, props.to - props.from)
	return props.points.map((point) => ({
		...point,
		x: chart.left + ((point.ts - props.from) / duration) * plotWidth,
		yMax: point.max == null ? null : chart.top + (1 - point.max / maxSpeed.value) * plotHeight,
		yAverage: point.average == null ? null : chart.top + (1 - point.average / maxSpeed.value) * plotHeight,
	}))
})

const maxSegments = computed(() =>
	plottedPoints.value.slice(1).flatMap((point, index) => {
		const previous = plottedPoints.value[index]
		if (previous?.yMax == null || point.yMax == null || point.max == null) return []
		return [{
			x1: previous.x,
			y1: previous.yMax,
			x2: point.x,
			y2: point.yMax,
			color: windSpeedColorHex(point.max),
			ts: point.ts,
			speed: point.max,
		}]
	})
)

const averageSegments = computed(() =>
	plottedPoints.value.slice(1).flatMap((point, index) => {
		const previous = plottedPoints.value[index]
		if (previous?.yAverage == null || point.yAverage == null || point.average == null) return []
		return [{
			x1: previous.x,
			y1: previous.yAverage,
			x2: point.x,
			y2: point.yAverage,
			color: windSpeedColorHex(point.average),
			ts: point.ts,
			speed: point.average,
		}]
	})
)

const hourlyReadings = computed(() => {
	const byHour = new Map<number, WindHistoryPoint>()
	for (const point of props.points) byHour.set(Math.floor(point.ts / 3600), point)
	return [...byHour.values()]
})

function formatHour(ts: number) {
	return new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(ts: number) {
	return new Date(ts * 1000).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
	<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
		<header class="mb-4 flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-base font-semibold text-gray-900">Windverlauf – letzte 24 Stunden</h3>
				<p class="mt-1 text-sm text-gray-500">Pichlberg · km/h · Messwerte etwa alle 10 Minuten</p>
			</div>
			<div class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
				<span class="inline-flex items-center gap-2 text-gray-700">
					<span class="h-0.5 w-5 bg-gray-500" aria-hidden="true"></span>
					Maximalwind (10′)
				</span>
				<span class="inline-flex items-center gap-2 text-gray-700">
					<span class="h-0.5 w-5 border-t-2 border-dashed border-gray-500" aria-hidden="true"></span>
					Durchschnitt (10′)
				</span>
			</div>
		</header>

		<p v-if="points.length === 0" class="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
			Für die letzten 24 Stunden sind keine Windmesswerte vorhanden.
		</p>
		<template v-else>
			<div class="overflow-x-auto">
				<svg
					class="h-auto min-w-[520px] w-full"
					:viewBox="`0 0 ${chart.width} ${chart.height}`"
					role="img"
					aria-label="Winddiagramm mit maximaler und durchschnittlicher Windgeschwindigkeit der letzten 24 Stunden"
				>
					<g v-for="tick in [0, 0.25, 0.5, 0.75, 1]" :key="tick">
						<line
							:x1="chart.left"
							:x2="chart.width - chart.right"
							:y1="chart.top + tick * plotHeight"
							:y2="chart.top + tick * plotHeight"
							stroke="#e5e7eb"
							stroke-width="1"
						/>
						<text
							:x="chart.left - 8"
							:y="chart.top + tick * plotHeight + 4"
							text-anchor="end"
							font-size="11"
							fill="#6b7280"
						>{{ Math.round(maxSpeed * (1 - tick)) }}</text>
					</g>
					<g v-for="tick in [0, 0.25, 0.5, 0.75, 1]" :key="`time-${tick}`">
						<text
							:x="chart.left + tick * plotWidth"
							:y="chart.height - 8"
							:text-anchor="tick === 0 ? 'start' : tick === 1 ? 'end' : 'middle'"
							font-size="11"
							fill="#6b7280"
						>{{ formatHour(from + tick * (to - from)) }}</text>
					</g>
					<line
						v-for="(segment, index) in maxSegments"
						:key="`max-${index}`"
						:x1="segment.x1"
						:y1="segment.y1"
						:x2="segment.x2"
						:y2="segment.y2"
						:stroke="segment.color"
						stroke-width="2.5"
						stroke-linecap="round"
					>
						<title>{{ formatDateTime(segment.ts) }} · Max: {{ formatWindSpeed(segment.speed) }} km/h</title>
					</line>
					<line
						v-for="(segment, index) in averageSegments"
						:key="`average-${index}`"
						:x1="segment.x1"
						:y1="segment.y1"
						:x2="segment.x2"
						:y2="segment.y2"
						:stroke="segment.color"
						stroke-width="2"
						stroke-dasharray="5 4"
						stroke-linecap="round"
					>
						<title>{{ formatDateTime(segment.ts) }} · Durchschnitt: {{ formatWindSpeed(segment.speed) }} km/h</title>
					</line>
				</svg>
			</div>

			<div class="mt-4 border-t border-gray-100 pt-3">
				<p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
					Stündliche Werte · Max / Durchschnitt (km/h)
				</p>
				<div class="flex gap-2 overflow-x-auto pb-1">
					<div
						v-for="point in hourlyReadings"
						:key="point.ts"
						class="min-w-[4.5rem] rounded-lg bg-gray-50 px-2 py-1.5 text-center"
					>
						<p class="text-xs tabular-nums text-gray-500">{{ formatHour(point.ts) }}</p>
						<p class="mt-1 whitespace-nowrap text-xs tabular-nums">
							<span :class="windSpeedColor(point.max, 'page')">{{ formatWindSpeed(point.max) }}</span>
							<span class="text-gray-400"> / </span>
							<span :class="windSpeedColor(point.average, 'page')">{{ formatWindSpeed(point.average) }}</span>
						</p>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
