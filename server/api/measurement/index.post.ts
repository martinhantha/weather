import { measurement } from '../../dbModels'
interface IRequestBody {
	json: Object
}
export default defineEventHandler(async (event) => {
	const body = await readBody(event)
	if (body.json)
		try {
			const newMeasurementData = await measurement.create({
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
})
