/**
 * Import MongoDB measurement collection into a SQL file for D1.
 * Run with: node --env-file=.env scripts/import-mongo-to-d1.mjs
 * Then apply: npx wrangler d1 execute weatherpichlberg --remote --file=./scripts/import-output.sql
 */
import mongoose from 'mongoose'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, 'import-output.sql')
// Keep small to avoid SQLITE_TOOBIG (D1 has a max statement size). Override with D1_IMPORT_BATCH_SIZE=5 if needed.
const BATCH_SIZE = Number(process.env.D1_IMPORT_BATCH_SIZE) || 10

const uri = process.env.MONGODB_URI
if (!uri) {
	console.error('Set MONGODB_URI (e.g. node --env-file=.env scripts/import-mongo-to-d1.mjs)')
	process.exit(1)
}

function escapeSql (str) {
	if (str == null) return 'NULL'
	return "'" + String(str).replace(/'/g, "''") + "'"
}

const schema = new mongoose.Schema(
	{ timeid: String, json: mongoose.Schema.Types.Mixed },
	{ collection: 'measurement' }
)
const Measurement = mongoose.models?.Measurement ?? mongoose.model('Measurement', schema, 'measurement')

async function main () {
	await mongoose.connect(uri)
	const docs = await Measurement.find().lean()
	await mongoose.disconnect()

	const lines = []
	for (let i = 0; i < docs.length; i += BATCH_SIZE) {
		const batch = docs.slice(i, i + BATCH_SIZE)
		const values = batch
			.map((d) => {
				const timeid = escapeSql(d.timeid ?? '')
				const json = escapeSql(JSON.stringify(d.json ?? {}))
				return `(${timeid}, ${json})`
			})
			.join(',\n  ')
		lines.push(`INSERT INTO measurement (timeid, json) VALUES\n  ${values};`)
	}

	writeFileSync(OUT_FILE, lines.join('\n\n'), 'utf8')
	console.log(`Wrote ${docs.length} documents to ${OUT_FILE} (${lines.length} batch(es)).`)
	console.log('Apply with: npx wrangler d1 execute weatherpichlberg --remote --file=./scripts/import-output.sql')
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
