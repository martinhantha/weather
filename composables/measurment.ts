export const useMeasurement = (measurementToCalc) => {
	let error = '',
		i = 0

	const measurement = ref({})
	measurement.conditions = []

	try {
		measurementToCalc.conditions.forEach((condition) => {
			measurement.conditions[i] = condition

			if (condition.temp) measurement.conditions[i].temp = fahrenheitToCelcius(condition.temp)
			if (condition.wind_speed_last) measurement.conditions[i].wind_speed_last = mpHToKmh(condition.wind_speed_last)
			if (condition.wind_speed_avg_last_1_min)
				measurement.conditions[i].wind_speed_avg_last_1_min = mpHToKmh(condition.wind_speed_avg_last_1_min)

			i++
		})
	} catch (e) {
		error = e
	}

	return { measurement, error }
}

function fahrenheitToCelcius(num) {
	return ((5 / 9) * (num - 32)).toFixed(1)
}
function mpHToKmh(num) {
	return (num * 1.609344).toFixed(0)
}
function mpsToKmh(num) {
	return (num * 3.6).toFixed(0)
}
