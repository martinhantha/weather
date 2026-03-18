/**
 * D1-backed DB layer for Cloudflare Workers. No mongoose.
 * Nitro exposes bindings at event.req.runtime.cloudflare.env; fallback to event.context.cloudflare.env.
 */
import type { H3Event } from 'h3'

type MeasurementDoc = { _id?: string; timeid?: string; json?: unknown }

type D1Binding = {
	prepare: (sql: string) => {
		bind: (...args: unknown[]) => { all: () => Promise<{ results?: unknown[] }>; first: () => Promise<unknown>; run: () => Promise<{ meta?: { last_row_id?: number }; changes?: number }> }
	}
}

function getD1(event: H3Event | undefined): D1Binding | null {
	const e = event as {
		req?: { runtime?: { cloudflare?: { env?: { DB?: D1Binding } } } }
		context?: { cloudflare?: { env?: { DB?: D1Binding } } }
	}
	const fromRuntime = e?.req?.runtime?.cloudflare?.env?.DB
	const fromContext = e?.context?.cloudflare?.env?.DB
	return fromRuntime ?? fromContext ?? null
}

export function d1IsConfigured(event: H3Event | undefined): boolean {
	return getD1(event) !== null
}

function rowToDoc(row: unknown): MeasurementDoc {
	const r = row as { id?: number; timeid?: string; json?: string }
	let json: unknown = null
	if (typeof r.json === 'string') {
		try {
			json = JSON.parse(r.json)
		} catch {
			json = r.json
		}
	}
	return {
		_id: r.id != null ? String(r.id) : undefined,
		timeid: r.timeid,
		json,
	}
}

export async function d1FindOne(
	event: H3Event | undefined,
	filter: Record<string, unknown>,
	sort?: Record<string, 1 | -1>
): Promise<MeasurementDoc | null> {
	const db = getD1(event)
	if (!db) return null

	const timeid = filter.timeid as string | undefined
	let sql = 'SELECT id, timeid, json FROM measurement'
	const params: unknown[] = []
	if (timeid != null) {
		sql += ' WHERE timeid = ?'
		params.push(timeid)
	}
	sql += ' ORDER BY id DESC LIMIT 1'

	const stmt = db.prepare(sql).bind(...params)
	const row = await stmt.first()
	if (!row) return null
	return rowToDoc(row)
}

export async function d1Find(
	event: H3Event | undefined,
	filter: Record<string, unknown>,
	opts: { sort?: Record<string, 1 | -1>; limit?: number } = {}
): Promise<MeasurementDoc[]> {
	const db = getD1(event)
	if (!db) return []

	const limit = opts.limit ?? 1
	let sql = 'SELECT id, timeid, json FROM measurement'
	const params: unknown[] = []
	const timeid = filter.timeid as string | undefined
	if (timeid != null) {
		sql += ' WHERE timeid = ?'
		params.push(timeid)
	}
	// Support sort by id desc (default) or by json field for maxWind
	const sortKey = opts.sort && Object.keys(opts.sort).length ? Object.keys(opts.sort)[0] : null
	if (sortKey === 'json.data.conditions.0.wind_speed_hi_last_10_min') {
		sql += ' ORDER BY json_extract(json, \'$.data.conditions[0].wind_speed_hi_last_10_min\') DESC'
	} else {
		sql += ' ORDER BY id DESC'
	}
	sql += ' LIMIT ?'
	params.push(limit)

	const stmt = db.prepare(sql).bind(...params)
	const result = await stmt.all()
	const rows = result.results ?? []
	return rows.map(rowToDoc)
}

export async function d1InsertOne(event: H3Event | undefined, document: Record<string, unknown>): Promise<{ insertedId: string }> {
	const db = getD1(event)
	if (!db) throw new Error('D1 not configured')

	const timeid = document.timeid as string
	const json = typeof document.json === 'string' ? document.json : JSON.stringify(document.json ?? null)
	const stmt = db.prepare('INSERT INTO measurement (timeid, json) VALUES (?, ?)').bind(timeid, json)
	const run = await stmt.run()
	const id = run.meta?.last_row_id != null ? String(run.meta.last_row_id) : ''
	return { insertedId: id }
}

export async function d1UpdateOne(
	event: H3Event | undefined,
	filter: Record<string, unknown>,
	update: Record<string, unknown>
): Promise<{ matchedCount: number; modifiedCount: number }> {
	const db = getD1(event)
	if (!db) throw new Error('D1 not configured')

	const timeid = filter.timeid as string
	const $set = update.$set as Record<string, unknown> | undefined
	const json = $set?.json != null ? (typeof $set.json === 'string' ? $set.json : JSON.stringify($set.json)) : null
	if (json === null) return { matchedCount: 0, modifiedCount: 0 }

	const stmt = db.prepare('UPDATE measurement SET json = ? WHERE timeid = ?').bind(json, timeid)
	const run = await stmt.run()
	return { matchedCount: run.meta?.changes ?? 0, modifiedCount: run.meta?.changes ?? 0 }
}
