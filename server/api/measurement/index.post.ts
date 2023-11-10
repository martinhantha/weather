import { measurement } from '../../dbModels'
interface IRequestBody {
	json: Object
}
export default defineEventHandler(async (event) => {
	console.log('POST /api/measurement')
	const body = await readBody(event)
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
