import type { IStationConfig } from '../types'

/**
 * Single station list used by both:
 * - Nuxt app page (`pages/index.vue`)
 * - Embedded widget (`widget/src/Widget.vue`)
 */
export const STATIONS: IStationConfig[] = [
	{ id: '33570', name: 'Pichlberg', source: 'weatherlink', station_id: '33570' },
	{ id: '92575', name: 'Sattele', source: 'weatherlink', station_id: '92575' },
	{ id: 'ISARNT29', name: 'Reinswald', source: 'pws', station_id: 'ISARNT29' },
	{ id: 'ISARNT1', name: 'Moosbrugg', source: 'pws', station_id: 'ISARNT1' },
	{ id: 'gufl-landeplatz', name: 'Gufl Landeplatz', source: 'weathercloud', station_id: '9123924154' },
	{ id: '82200MS', name: 'Sarnthein', source: 'southtyrol', station_code: '82200MS' },
	{ id: '80100SF', name: 'Pens Tramintal', source: 'southtyrol', station_code: '80100SF' },
	{ id: 'pens', name: 'Pens', source: 'weathercloud', station_id: '6065784057' },
	{ id: '35100WS', name: 'Jaufen', source: 'southtyrol', station_code: '35100WS' },
	{ id: '82500WS', name: 'Rittnerhorn', source: 'southtyrol', station_code: '82500WS' },
	{ id: '69900MS', name: 'Plose', source: 'southtyrol', station_code: '69900MS' },
	{ id: '66000WS', name: 'Dannelspitz', source: 'southtyrol', station_code: '66000WS' },
	{ id: '37100MS', name: 'Sterzing', source: 'southtyrol', station_code: '37100MS' },
	{ id: '06040WS', name: 'Sulden Schöntaufspitze', source: 'southtyrol', station_code: '06040WS' },
]

/** Device IDs for `source === 'weathercloud'` entries (order matches STATIONS). */
export const WEATHERCLOUD_DEVICE_IDS: string[] = STATIONS.filter((s) => s.source === 'weathercloud').map(
	(s) => s.station_id!,
)

/**
 * Station IDs that have live data (real-time); show green LIVE indicator.
 * Weathercloud values are typically refreshed quickly, so treat them as live too.
 */
export const LIVE_STATION_IDS = new Set(['33570', 'ISARNT29', 'ISARNT1'])

export function getSouthTyrolCodes(): string {
	return STATIONS.filter((s) => s.source === 'southtyrol')
		.map((s) => s.station_code!)
		.join(',')
}

