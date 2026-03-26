import type { ICondition } from '../types'

export function degToDir(deg: number): string {
	const number = Math.round(deg / 22.5 + 0.5)
	const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
	return directions[number % 16]
}

function windSpeedBand(speed: number | null | undefined): 'gray' | 'green' | 'yellow' | 'orange' | 'red' | 'black' {
	if (speed == null) return 'gray'
	if (speed <= 14) return 'green'
	if (speed <= 25) return 'yellow'
	if (speed <= 30) return 'orange'
	if (speed <= 38) return 'red'
	return 'black'
}

/**
 * Tailwind/custom class resolver used by both:
 * - Nuxt page: `text-*` classes
 * - Widget: `w-wind-*` classes (see widget/src/Widget.vue style)
 */
export function windSpeedColor(speed: number | null | undefined, variant: 'page' | 'widget'): string {
	const band = windSpeedBand(speed)
	if (variant === 'page') {
		switch (band) {
			case 'gray':
				return 'text-gray-500'
			case 'green':
				return 'text-green-600'
			case 'yellow':
				return 'text-yellow-500'
			case 'orange':
				return 'text-orange-600'
			case 'red':
				return 'text-red-600'
			case 'black':
				return 'text-black'
		}
	}
	// widget
	switch (band) {
		case 'gray':
			return 'w-wind-gray'
		case 'green':
			return 'w-wind-green'
		case 'yellow':
			return 'w-wind-yellow'
		case 'orange':
			return 'w-wind-orange'
		case 'red':
			return 'w-wind-red'
		case 'black':
			return 'w-wind-black'
	}
}

/** Hex color for wind speed arrows, same bands as windSpeedColor. */
export function windSpeedColorHex(speed: number | null | undefined): string {
	const band = windSpeedBand(speed)
	switch (band) {
		case 'gray':
			return '#6b7280' // gray-500
		case 'green':
			return '#16a34a' // green-600
		case 'yellow':
			return '#eab308' // yellow-500
		case 'orange':
			return '#ea580c' // orange-600
		case 'red':
			return '#dc2626' // red-600
		case 'black':
			return '#000000'
	}
}

/** Pichlberg (33570) wind direction is 180° off; correct for display. */
export function windDirDeg(cond: Partial<ICondition> | null, stationId: string): number {
	const raw = cond?.wind_dir_last ?? 0
	if (stationId === '33570') return (raw + 180) % 360
	return raw
}

