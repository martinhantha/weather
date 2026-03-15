import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
	const body = await readBody(event)

	if (!body?.json || !db.isConfigured()) return

	const d = new Date()
	const datestring =
		d.getFullYear() +
		'-' +
		(d.getMonth() + 1) +
		'-' +
		d.getDate() +
		'-' +
		d.getHours() +
		'-' +
		String(Math.floor(d.getMinutes() / 10))
	const filter = { timeid: datestring }

	try {
		const existing = await db.findOne(filter)
		if (existing) {
			await db.updateOne(filter, { $set: { json: body.json } })
			return { id: existing._id, json: body.json }
		}
		const { insertedId } = await db.insertOne({ timeid: datestring, json: body.json })
		return { id: insertedId, json: body.json }
	} catch (err) {
		console.error(err)
		setResponseStatus(event, 500)
		return { code: 'ERROR', message: 'Something wrong.' }
	}
})
