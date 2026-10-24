/**
 * Pioupiou (Leiter Spitz) wind history.
 * The archive API serves ~5-minute readings; we copy them into Mongo (`wind_history`) so history
 * survives beyond what Pioupiou keeps, and gaps from server downtime refill on the next poll.
 * Docs: https://developers.pioupiou.fr/api/archive/
 */
import mongoose from 'mongoose'
import { WindSample } from '../models/windSample.model'

const SLOT_SEC = 10 * 60

type PioupiouArchiveResponse = {
	legend?: string[]
	data?: Array<Array<string | number | null>>
}

type WindSampleRow = { station: string; ts: number; min: number | null; average: number | null; max: number | null; dir: number | null }

export type WindHistoryPoint = { ts: number; max: number | null; average: number | null; dir: number | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = WindSample as any

function dbReady(): boolean {
	return mongoose.connection.readyState === 1
}

function num(value: unknown): number | null {
	const n = Number(value)
	return value != null && Number.isFinite(n) ? n : null
}

async function fetchArchive(stationId: string, start: string): Promise<WindSampleRow[]> {
	const raw = await $fetch<PioupiouArchiveResponse>(
		`http://api.pioupiou.fr/v1/archive/${encodeURIComponent(stationId)}`,
		{ query: { start, stop: 'now' }, timeout: 10_000, headers: { Accept: 'application/json' } },
	)
	const legend = raw?.legend ?? []
	const col = (name: string) => legend.indexOf(name)
	const [iTime, iMin, iAvg, iMax, iDir] = ['time', 'wind_speed_min', 'wind_speed_avg', 'wind_speed_max', 'wind_heading'].map(col)

	const rows: WindSampleRow[] = []
	for (const row of raw?.data ?? []) {
		const ts = Math.floor(new Date(String(row[iTime])).getTime() / 1000)
		if (!Number.isFinite(ts)) continue
		rows.push({ station: stationId, ts, min: num(row[iMin]), average: num(row[iAvg]), max: num(row[iMax]), dir: num(row[iDir]) })
	}
	return rows
}

/** Fetch the last day from Pioupiou and upsert it into `wind_history`. */
export async function savePioupiouHistory(stationId: string): Promise<{ ok: boolean; saved?: number; error?: string }> {
	if (!dbReady()) return { ok: false, error: 'No database connection' }
	try {
		const rows = await fetchArchive(stationId, 'last-day')
		if (rows.length === 0) return { ok: true, saved: 0 }
		await M.bulkWrite(
			rows.map((row) => ({
				updateOne: { filter: { station: row.station, ts: row.ts }, update: { $set: row }, upsert: true },
			})),
			{ ordered: false },
		)
		return { ok: true, saved: rows.length }
	} catch (err) {
		console.error(`[pioupiouHistory] save ${stationId} failed:`, err instanceof Error ? err.message : err)
		return { ok: false, error: 'Save failed' }
	}
}

/** Group raw readings into 10-minute slots: highest gust, mean wind, latest direction. */
function toSlots(rows: Array<Pick<WindSampleRow, 'ts' | 'average' | 'max' | 'dir'>>): WindHistoryPoint[] {
	const bySlot = new Map<number, { max: number | null; sum: number; count: number; dir: number | null; dirTs: number }>()
	for (const row of rows) {
		const slot = Math.floor(row.ts / SLOT_SEC) * SLOT_SEC
		const acc = bySlot.get(slot) ?? { max: null, sum: 0, count: 0, dir: null, dirTs: -1 }
		if (row.max != null) acc.max = acc.max == null ? row.max : Math.max(acc.max, row.max)
		if (row.average != null) {
			acc.sum += row.average
			acc.count++
		}
		if (row.dir != null && row.ts > acc.dirTs) {
			acc.dir = row.dir
			acc.dirTs = row.ts
		}
		bySlot.set(slot, acc)
	}
	return [...bySlot.entries()]
		.sort(([a], [b]) => a - b)
		.map(([ts, acc]) => ({
			ts,
			max: acc.max == null ? null : Math.round(acc.max),
			average: acc.count ? Math.round(acc.sum / acc.count) : null,
			dir: acc.dir,
		}))
}

/** History from Mongo; without a DB (or when it has nothing yet) read Pioupiou's archive directly. */
export async function loadPioupiouHistory(stationId: string, from: number, to: number): Promise<WindHistoryPoint[]> {
	if (dbReady()) {
		try {
			const docs = await M.find({ station: stationId, ts: { $gte: from, $lte: to } })
				.select('ts average max dir')
				.sort({ ts: 1 })
				.lean()
			if (docs.length) return toSlots(docs)
		} catch (err) {
			console.error(`[pioupiouHistory] load ${stationId} failed:`, err instanceof Error ? err.message : err)
		}
	}
	const rows = await fetchArchive(stationId, new Date(from * 1000).toISOString())
	return toSlots(rows.filter((row) => row.ts >= from && row.ts <= to))
}
