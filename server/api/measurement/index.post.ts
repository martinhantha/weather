import { measurement } from '../../dbModels'
interface IRequestBody {
	json: Object
}
export default defineEventHandler(async (event) => {
	const body = await readBody(event)

	if (body.json) {
		const d = new Date(),
			datestring =
				d.getFullYear() +
				'-' +
				(d.getMonth() + 1) +
				'-' +
				d.getDate() +
				'-' +
				d.getHours() +
				'-' +
				parseInt(d.getMinutes() / 10),
			filter = { timeid: datestring },
			current = await measurement.findOne(filter)

		if (current) {
			try {
				const newMeasurementData = await measurement.updateOne(filter, {
					json: body.json,
				})
				return {
					id: newMeasurementData._id,
					json: newMeasurementData.json,
				}
			} catch (err) {
				console.dir(err)
				event.res.statusCode = 500
				return {
					code: 'ERROR',
					message: 'Something wrong.',
				}
			}
		} else {
			try {
				const newMeasurementData = await measurement.create({
					timeid: datestring,
					json: body.json,
				})
				return {
					id: newMeasurementData._id,
					json: newMeasurementData.json,
				}
			} catch (err) {
				console.dir(err)
				event.res.statusCode = 500
				return {
					code: 'ERROR',
					message: 'Something wrong.',
				}
			}
		}
	}
})
