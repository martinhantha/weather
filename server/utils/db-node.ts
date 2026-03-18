/**
 * Node-only DB layer: mongoose (MONGODB_URI). Only imported dynamically from db.ts when not using D1.
 */
import { Measurement } from '../models/measurement.model'

export type MeasurementDoc = { _id?: string; timeid?: string; json?: unknown }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = Measurement as any

function idToString(doc: { _id?: unknown }): string | undefined {
	if (doc._id == null) return undefined
	if (typeof doc._id === 'string') return doc._id
	if (typeof doc._id === 'object' && doc._id !== null && '$oid' in (doc._id as object))
		return (doc._id as { $oid: string }).$oid
	return String((doc._id as { toString?: () => string })?.toString?.() ?? doc._id)
}

export function isConfigured(): boolean {
	const config = useRuntimeConfig()
	return Boolean((config.mongoUrl as string)?.trim())
}

export async function findOne(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>): Promise<MeasurementDoc | null> {
	let q = M.findOne(filter).select('json timeid')
	if (sort && Object.keys(sort).length) q = q.sort(sort)
	const doc = await q.lean()
	if (!doc) return null
	const d = doc as { _id?: unknown; timeid?: string; json?: unknown }
	return { _id: idToString(d), timeid: d.timeid, json: d.json }
}

export async function find(
	filter: Record<string, unknown>,
	opts: { sort?: Record<string, 1 | -1>; limit?: number } = {}
): Promise<MeasurementDoc[]> {
	let q = M.find(filter).select('json timeid')
	if (opts.sort && Object.keys(opts.sort).length) q = q.sort(opts.sort)
	if (opts.limit != null) q = q.limit(opts.limit)
	const docs = await q.lean()
	// #region agent log
	fetch('http://127.0.0.1:7491/ingest/bfe2b03b-e598-40e2-8df9-2a0a3917f88b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0bf217'},body:JSON.stringify({sessionId:'0bf217',location:'db-node.ts:find',message:'node find (mongoose)',data:{len:(docs as unknown[]).length},hypothesisId:'B,E',timestamp:Date.now()})}).catch(()=>{})
	// #endregion
	return (docs as unknown[]).map((d: unknown) => {
		const x = d as { _id?: unknown; timeid?: string; json?: unknown }
		return { _id: idToString(x), timeid: x.timeid, json: x.json }
	})
}

export async function insertOne(document: Record<string, unknown>): Promise<{ insertedId: string }> {
	const created = await M.create(document)
	return { insertedId: idToString(created) ?? '' }
}

export async function updateOne(
	filter: Record<string, unknown>,
	update: Record<string, unknown>
): Promise<{ matchedCount: number; modifiedCount: number }> {
	const $set = update.$set as Record<string, unknown> | undefined
	if (!$set?.json) return { matchedCount: 0, modifiedCount: 0 }
	const r = await M.updateOne(filter, { $set })
	return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount }
}
