import { Fragment, type PropType, h, defineComponent } from 'vue'
import type { ICondition, IStationConfig } from '../../types'
import { degToDir, windDirDeg, windSpeedColor, windSpeedColorHex } from '../windDisplay'

type StationData = { ts: number; condition: Partial<ICondition> }

function formatTime(ts: number) {
	return new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default defineComponent({
	name: 'WindStationGrid',
	props: {
		variant: {
			type: String as PropType<'page' | 'widget'>,
			required: true,
			validator: (v: string) => v === 'page' || v === 'widget',
		},
		stations: {
			type: Array as PropType<IStationConfig[]>,
			required: true,
		},
		liveStationIds: {
			type: Object as PropType<Set<string>>,
			required: true,
		},
		getStationData: {
			type: Function as PropType<(station: IStationConfig) => StationData | null>,
			required: true,
		},
		selectedStationId: {
			type: String as PropType<string | undefined>,
			required: false,
		},
		onSelect: {
			type: Function as PropType<((stationId: string) => void) | undefined>,
			required: false,
		},
	},
	setup(props) {
		return () =>
			h(
				Fragment,
				null,
				props.stations.flatMap((station) => {
					const data = props.getStationData(station)
					if (props.variant === 'page') {
						if (!data) return []

						const cond = data.condition
						const isSelected = props.selectedStationId === station.id

						const tempNode =
							cond.temp != null
								? h('div', { class: 'flex items-baseline gap-1.5' }, [
										h('span', { class: 'text-gray-800' }, `${cond.temp} °C`),
								  ])
								: null

						const timeNode = data.ts
							? h('span', { class: 'text-xs tabular-nums text-gray-500' }, formatTime(data.ts))
							: null

						const liveNode = props.liveStationIds.has(station.id)
							? h('span', { class: 'inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800' }, [
									h('span', { class: 'h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse' }),
									'LIVE',
							  ])
							: null

						const windDir =
							cond.wind_dir_last != null ? degToDir(windDirDeg(cond, station.id)) : '—'

						const arrowSvg =
							cond.wind_dir_last != null
								? h(
										'svg',
										{
											viewBox: '0 0 24 12',
											xmlns: 'http://www.w3.org/2000/svg',
											class: 'h-9 w-9',
											style: {
												transform: `rotate(${(windDirDeg(cond, station.id) + 180) % 360}deg)`,
											},
										},
										[
											h('path', {
												d: 'M12 0 L9 12 L12 11 L15 12 Z',
												fill: windSpeedColorHex(cond.wind_speed_last ?? null),
												stroke: windSpeedColorHex(cond.wind_speed_hi_last_10_min ?? null),
												'stroke-width': 0.8,
												'stroke-linejoin': 'round',
											}),
										]
								  )
								: null

						return [
							h(
								'article',
								{
									'data-station-id': station.id,
									class:
										'cursor-pointer rounded-xl border-2 p-5 shadow-sm transition hover:border-sky-300 hover:shadow bg-gray-200 ' +
										(isSelected ? 'border-sky-500 ring-2 ring-sky-200' : 'border-gray-200'),
									onClick: props.onSelect ? () => props.onSelect?.(station.id) : undefined,
								},
								[
									h('div', { class: 'space-y-3 border-gray-100' }, [
										h('div', { class: 'flex items-start justify-between gap-3 border-b pb-4' }, [
											h('div', { class: 'min-w-0 flex-1' }, [h('p', { class: 'text-base font-medium text-gray-900' }, station.name)]),
											h('div', { class: 'flex items-center justify-between text-base text-gray-600' }, [tempNode]),
											h('div', { class: 'flex shrink-0 items-center gap-2' }, [timeNode, liveNode]),
										]),
										h('div', { class: 'flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base text-gray-600 justify-between' }, [
											h('div', { class: 'flex items-center gap-2' }, [
												h(
													'span',
													{ class: windSpeedColor(cond.wind_speed_last, 'page') },
													[
														h('span', { class: 'font-semibold' }, cond.wind_speed_last ?? '—'),
														h('span', { class: 'text-xs text-gray-600' }, ' km/h'),
													]
												),
												h('span', { class: 'hidden text-gray-300 sm:inline' }, '·'),
												h(
													'span',
													{ class: windSpeedColor(cond.wind_speed_hi_last_10_min, 'page') },
													[
														h('span', { class: 'font-semibold' }, cond.wind_speed_hi_last_10_min ?? '—'),
														h('span', { class: 'text-xs text-gray-600' }, " km/h 10′ max"),
													]
												),
												h('span', { class: 'hidden text-gray-300 sm:inline' }, '·'),
												h('span', { class: 'text-gray-600' }, [
													h('span', null, cond.wind_speed_avg_last_10_min ?? '—'),
													h('span', { class: 'text-xs text-gray-600' }, " km/h 10′ Ø"),
												]),
											]),
											h('div', { class: 'flex items-center gap-2 align-end' }, [
												arrowSvg,
												h('div', { class: 'flex items-baseline gap-1.5' }, [
													h('span', { class: 'font-semibold text-gray-900' }, windDir),
												]),
											]),
										]),
									]),
								]
							),
						]
					}

					// widget
					if (!data) return []
					const cond = data.condition

					const tempNode =
						cond.temp != null ? h('span', { class: 'w-temp-top' }, `${cond.temp} °C`) : null
					const timeNode = data.ts ? h('span', { class: 'w-time' }, formatTime(data.ts)) : null
					const liveNode = props.liveStationIds.has(station.id)
						? h('span', { class: 'w-live' }, [h('span', { class: 'w-live-dot' }), 'LIVE'])
						: null

					const windDir = cond.wind_dir_last != null ? degToDir(windDirDeg(cond, station.id)) : '—'
					const arrowSvg =
						cond.wind_dir_last != null
							? h(
									'svg',
									{
										viewBox: '0 0 24 12',
										class: 'w-arrow',
										style: {
											transform: `rotate(${(windDirDeg(cond, station.id) + 180) % 360}deg)`,
										},
									},
									[
										h('path', {
											d: 'M12 0 L9 12 L12 11 L15 12 Z',
											fill: windSpeedColorHex(cond.wind_speed_last ?? null),
											stroke: windSpeedColorHex(cond.wind_speed_hi_last_10_min ?? null),
											'stroke-width': 0.8,
											'stroke-linejoin': 'round',
										}),
									]
							  )
							: null

					return [
						h(
							'article',
							{ class: 'w-card' },
							[
								h('div', { class: 'w-card-inner' }, [
									h('div', { class: 'w-card-top' }, [
										h('p', { class: 'w-station-name' }, station.name),
										h('div', { class: 'w-card-top-right' }, [tempNode, timeNode, liveNode]),
									]),
									h('div', { class: 'w-card-bottom' }, [
										h('div', { class: 'w-winds' }, [
											h('span', { class: windSpeedColor(cond.wind_speed_last, 'widget') }, [
												h('strong', null, cond.wind_speed_last ?? '—'),
												h('span', { class: 'w-wind-unit-small' }, ' km/h'),
											]),
											h('span', { class: windSpeedColor(cond.wind_speed_hi_last_10_min, 'widget') }, [
												h('strong', null, cond.wind_speed_hi_last_10_min ?? '—'),
												h('span', { class: 'w-wind-unit-small' }, " km/h 10′ max"),
											]),
											h('span', { class: 'w-avg' }, [
												h('strong', null, cond.wind_speed_avg_last_10_min ?? '—'),
												h('span', { class: 'w-wind-unit-small' }, " km/h 10′ Ø"),
											]),
										]),
										h('div', { class: 'w-dir-wrap' }, [
											arrowSvg,
											h('span', { class: 'w-dir-text' }, windDir),
										]),
									]),
								]),
							],
						),
					]
				})
			)
	},
})

