/**
 * MongoDB Atlas Data API client using fetch.
 * Works on Node and Cloudflare Workers. Set MONGODB_APP_ID, MONGODB_API_KEY, and optionally
 * MONGODB_DATA_SOURCE / MONGODB_DATABASE in env (or runtimeConfig).
 */
const COLLECTION = 'measurement'

type DataApiConfig = {
  baseUrl: string
  apiKey: string
  dataSource: string
  database: string
}

function getConfig(): DataApiConfig | null {
  const config = useRuntimeConfig()
  const appId = (config.mongoDataApiAppId as string)?.trim()
  const apiKey = (config.mongoDataApiKey as string)?.trim()
  if (!appId || !apiKey) return null
  return {
    baseUrl: `https://data.mongodb-api.com/app/${appId}/endpoint/data/v1`,
    apiKey,
    dataSource: (config.mongoDataApiDataSource as string) || 'Cluster0',
    database: (config.mongoDataApiDatabase as string) || 'mydb',
  }
}

async function dataApiFetch<T = unknown>(action: string, body: Record<string, unknown>): Promise<T> {
  const cfg = getConfig()
  if (!cfg) throw new Error('MongoDB Data API not configured: set MONGODB_APP_ID and MONGODB_API_KEY')
  const url = `${cfg.baseUrl}/action/${action}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      dataSource: cfg.dataSource,
      database: cfg.database,
      collection: COLLECTION,
      ...body,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MongoDB Data API ${action} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

export interface MeasurementDoc {
  _id?: { $oid: string }
  timeid?: string
  json?: unknown
  createdAt?: string
}

/** Find one document. sort: e.g. { _id: -1 } */
export async function findOne(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>): Promise<MeasurementDoc | null> {
  const payload: Record<string, unknown> = { filter }
  if (sort && Object.keys(sort).length) payload.sort = sort
  const out = await dataApiFetch<{ document?: MeasurementDoc }>('findOne', payload)
  return out.document ?? null
}

/** Find documents. sort: e.g. { _id: -1 }, limit default 1 */
export async function find(
  filter: Record<string, unknown>,
  opts: { sort?: Record<string, 1 | -1>; limit?: number } = {}
): Promise<MeasurementDoc[]> {
  const { sort, limit = 1 } = opts
  const payload: Record<string, unknown> = { filter }
  if (sort && Object.keys(sort).length) payload.sort = sort
  if (limit != null) payload.limit = limit
  const out = await dataApiFetch<{ documents: MeasurementDoc[] }>('find', payload)
  return out.documents ?? []
}

/** Insert one document. Returns insertedId. */
export async function insertOne(document: Record<string, unknown>): Promise<{ insertedId: string }> {
  const out = await dataApiFetch<{ insertedId: string }>('insertOne', { document })
  return out
}

/** Update one document. update e.g. { $set: { json: ... } } */
export async function updateOne(
  filter: Record<string, unknown>,
  update: Record<string, unknown>
): Promise<{ matchedCount: number; modifiedCount: number }> {
  const out = await dataApiFetch<{ matchedCount: number; modifiedCount: number }>('updateOne', {
    filter,
    update,
  })
  return out
}

/** Check if Data API is configured (does not test connectivity). */
export function isDataApiConfigured(): boolean {
  return getConfig() !== null
}
