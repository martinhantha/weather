/**
 * Unified DB layer: D1 (Cloudflare) when event has DB binding; else Node (mongoose via MONGODB_URI).
 * Cloudflare bundle only uses db-d1. Node uses db-node (dynamic import so mongoose is not in CF bundle).
 */
import type { H3Event } from 'h3'
import * as dbD1 from './db-d1'

export type MeasurementDoc = { _id?: string; timeid?: string; json?: unknown }

function hasD1(event: H3Event | undefined): boolean {
	return dbD1.d1IsConfigured(event)
}

function useUri(): boolean {
	const config = useRuntimeConfig()
	return Boolean((config.mongoUrl as string)?.trim())
}

/** D1 when event has binding; else URI (mongoose). Sync so callers can use without await. */
export function isConfigured(event?: H3Event): boolean {
	if (hasD1(event)) return true
	return useUri()
}

export async function findOne(
	event: H3Event | undefined,
	filter: Record<string, unknown>,
	sort?: Record<string, 1 | -1>
): Promise<MeasurementDoc | null> {
	if (hasD1(event)) return dbD1.findOne(event, filter, sort)
	const node = await import('./db-node')
	return node.nodeFindOne(filter, sort)
}

export async function find(
	event: H3Event | undefined,
	filter: Record<string, unknown>,
	opts: { sort?: Record<string, 1 | -1>; limit?: number } = {}
): Promise<MeasurementDoc[]> {
	if (hasD1(event)) return dbD1.d1Find(event, filter, opts)
	const node = await import('./db-node')
	return node.nodeFind(filter, opts)
}

export async function insertOne(event: H3Event | undefined, document: Record<string, unknown>): Promise<{ insertedId: string }> {
	if (hasD1(event)) return dbD1.d1InsertOne(event, document)
	const node = await import('./db-node')
	return node.nodeInsertOne(document)
}

export async function updateOne(
	event: H3Event | undefined,
	filter: Record<string, unknown>,
	update: Record<string, unknown>
): Promise<{ matchedCount: number; modifiedCount: number }> {
	if (hasD1(event)) return dbD1.d1UpdateOne(event, filter, update)
	const node = await import('./db-node')
	return node.nodeUpdateOne(filter, update)
}
