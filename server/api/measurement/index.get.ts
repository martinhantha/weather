import { measurement } from '../../dbModels'
interface IRequestBody {
	json: Object
}
export default defineEventHandler(async (event) => {
	console.log('GET /api/measurement')
	try {
		const newMeasurementData = await measurement.findOne({}, null, { sort: { createdAt: -1} })
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
