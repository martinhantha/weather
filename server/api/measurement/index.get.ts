import { measurement } from '../../dbModels'

export default defineEventHandler(async (event) => {
	// console.log('GET /api/measurement')
	const queryResult = getQuery(event)
	const sortByTimeStamp = { createdAt: -1 }
	const sortByTimeMaxWind = { 'json.data.conditions.0.wind_speed_hi_last_10_min': 1 }
	let query = {}

	if (queryResult.maxWind) {
		query = { createdAt: { $gte: new Date().setMinutes(new Date().getMinutes() - queryResult.maxWind) } }
	}
	try {
		const newMeasurementData = await measurement.aggregate([
			{ $match: query },
			{ $sort: query.maxWind ? sortByTimeMaxWind : sortByTimeStamp },
			{ $limit: 1 },
		])

		console.log(query)
		console.log(newMeasurementData)
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
