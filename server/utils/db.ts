/**
 * Unified DB layer: uses MONGODB_URI + mongoose when set, else MongoDB Data API (fetch).
 * Same interface for both; works on Node (URI) and Cloudflare (Data API or stub).
 */
import { Measurement } from '../models/measurement.model'
import * as dataApi from './mongo-data-api'

type MeasurementModel = {
	find: (f: object) => { select: (s: string) => { sort: (s: object) => { limit: (n: number) => { lean: () => Promise<unknown[]> } }; limit: (n: number) => { lean: () => Promise<unknown[]> }; lean: () => Promise<unknown[]> } }
	findOne: (f: object) => { select: (s: string) => { sort: (s: object) => { lean: () => Promise<unknown> }; lean: () => Promise<unknown> } }
	create: (doc: object) => Promise<{ _id?: unknown }>
	updateOne: (filter: object, update: object) => Promise<{ matchedCount: number; modifiedCount: number }>
}
const M = Measurement as unknown as MeasurementModel

export type MeasurementDoc = { _id?: string; timeid?: string; json?: unknown }

const DEBUG_LOG = (data: Record<string, unknown>) => {
	// #region agent log
	fetch('http://127.0.0.1:7491/ingest/bfe2b03b-e598-40e2-8df9-2a0a3917f88b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0bf217' }, body: JSON.stringify({ sessionId: '0bf217', location: 'db.ts', message: 'db layer', data, timestamp: Date.now(), hypothesisId: data.hypothesisId as string }) }).catch(() => {})
	// #endregion
}

function useUri(): boolean {
	const config = useRuntimeConfig()
	// Use Data API when explicitly requested (switch back to App Services)
	if (config.mongoUseDataApi) return false
	return Boolean((config.mongoUrl as string)?.trim())
}

/** URI (mongoose) when MONGODB_URI set and not MONGODB_USE_DATA_API; else Data API when configured. */
export function isConfigured(): boolean {
	const uri = useUri()
	const dataApiOk = dataApi.isDataApiConfigured()
	DEBUG_LOG({ hypothesisId: 'A', hypothesisId2: 'E', useUri: uri, dataApiConfigured: dataApiOk, configured: uri || dataApiOk })
	return uri || dataApiOk
}

function idToString(doc: { _id?: unknown }): string | undefined {
	if (doc._id == null) return undefined
	if (typeof doc._id === 'string') return doc._id
	if (typeof doc._id === 'object' && doc._id !== null && '$oid' in (doc._id as object))
		return (doc._id as { $oid: string }).$oid
	return String((doc._id as { toString?: () => string })?.toString?.() ?? doc._id)
}

export async function findOne(
	filter: Record<string, unknown>,
	sort?: Record<string, 1 | -1>
): Promise<MeasurementDoc | null> {
	if (useUri()) {
		let q = M.findOne(filter).select('json timeid')
		if (sort && Object.keys(sort).length) q = q.sort(sort) as typeof q
		const doc = await q.lean()
		if (!doc) return null
		const d = doc as { _id?: unknown; timeid?: string; json?: unknown }
		return { _id: idToString(d), timeid: d.timeid, json: d.json }
	}
	const doc = await dataApi.findOne(filter, sort)
	if (!doc) return null
	return { _id: idToString(doc), timeid: doc.timeid, json: doc.json }
}

export async function find(
	filter: Record<string, unknown>,
	opts: { sort?: Record<string, 1 | -1>; limit?: number } = {}
): Promise<MeasurementDoc[]> {
	const uri = useUri()
	DEBUG_LOG({ hypothesisId: 'B', hypothesisId2: 'C', backend: uri ? 'mongoose' : 'dataApi', filterKeys: Object.keys(filter), limit: opts.limit })
	if (uri) {
		let q = M.find(filter).select('json timeid')
		if (opts.sort && Object.keys(opts.sort).length) q = q.sort(opts.sort) as typeof q
		if (opts.limit != null) q = q.limit(opts.limit) as typeof q
		const docs = await q.lean()
		DEBUG_LOG({ hypothesisId: 'B', backend: 'mongoose', rawDocsLength: Array.isArray(docs) ? docs.length : 'not_array' })
		const mapped = docs.map((d: unknown) => {
			const x = d as { _id?: unknown; timeid?: string; json?: unknown }
			return { _id: idToString(x), timeid: x.timeid, json: x.json }
		})
		// Fallback: when URI returns 0 docs but Data API is configured, try Data API (e.g. data lives in App Services)
		if (mapped.length === 0 && dataApi.isDataApiConfigured()) {
			DEBUG_LOG({ hypothesisId: 'B', path: 'fallback_to_dataApi', reason: 'mongoose_returned_0' })
			try {
				const dataApiDocs = await dataApi.find(filter, opts)
				DEBUG_LOG({ hypothesisId: 'C', backend: 'dataApi', rawDocsLength: dataApiDocs?.length ?? 'null' })
				return dataApiDocs.map((d) => ({ _id: idToString(d), timeid: d.timeid, json: d.json }))
			} catch (err) {
				// Data API failed (e.g. 404 wrong App ID, network) — return empty rather than throw
				const msg = err instanceof Error ? err.message : String(err)
				DEBUG_LOG({ hypothesisId: 'D', path: 'fallback_dataApi_error', error: msg })
				return mapped
			}
		}
		return mapped
	}
	const docs = await dataApi.find(filter, opts)
	DEBUG_LOG({ hypothesisId: 'C', backend: 'dataApi', rawDocsLength: docs?.length ?? 'null' })
	return docs.map((d) => ({ _id: idToString(d), timeid: d.timeid, json: d.json }))
}

export async function insertOne(document: Record<string, unknown>): Promise<{ insertedId: string }> {
	if (useUri()) {
		const created = await M.create(document)
		return { insertedId: idToString(created) ?? '' }
	}
	const result = await dataApi.insertOne(document)
	const id = typeof result.insertedId === 'string' ? result.insertedId : (result.insertedId as { $oid?: string })?.$oid ?? ''
	return { insertedId: id }
}

export async function updateOne(
	filter: Record<string, unknown>,
	update: Record<string, unknown>
): Promise<{ matchedCount: number; modifiedCount: number }> {
	if (useUri()) {
		const result = await M.updateOne(filter, update)
		return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }
	}
	return dataApi.updateOne(filter, update)
}
