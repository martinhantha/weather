export const useMeasurement = (measurementToCalc) => {
	let error = '',
		i = 0

	let measurement = {}
	measurement.conditions = []

	try {

		measurementToCalc.value.data.json.data.conditions.forEach((condition) => {
			measurement.conditions[i] = condition

			if (condition.temp) measurement.conditions[i].temp = fahrenheitToCelcius(condition.temp)
			if (condition.dew_point) measurement.conditions[i].dew_point = fahrenheitToCelcius(condition.dew_point)
			if (condition.heat_index) measurement.conditions[i].heat_index = fahrenheitToCelcius(condition.heat_index)
			if (condition.wind_chill) measurement.conditions[i].wind_chill = fahrenheitToCelcius(condition.wind_chill)
			if (condition.thw_index) measurement.conditions[i].thw_index = fahrenheitToCelcius(condition.thw_index)
			if (condition.thsw_index) measurement.conditions[i].thsw_index = fahrenheitToCelcius(condition.thsw_index)
			if (condition.wind_speed_last) measurement.conditions[i].wind_speed_last = mpHToKmh(condition.wind_speed_last)
			if (condition.wind_speed_avg_last_1_min)
				measurement.conditions[i].wind_speed_avg_last_1_min = mpHToKmh(condition.wind_speed_avg_last_1_min)
			if (condition.wind_speed_avg_last_2_min)
				measurement.conditions[i].wind_speed_avg_last_2_min = mpHToKmh(condition.wind_speed_avg_last_2_min)
			if (condition.wind_speed_hi_last_2_min)
				measurement.conditions[i].wind_speed_hi_last_2_min = mpHToKmh(condition.wind_speed_hi_last_2_min)
			if (condition.wind_speed_avg_last_10_min)
				measurement.conditions[i].wind_speed_avg_last_10_min = mpHToKmh(condition.wind_speed_avg_last_10_min)
			if (condition.wind_speed_hi_last_10_min)
				measurement.conditions[i].wind_speed_hi_last_10_min = mpHToKmh(condition.wind_speed_hi_last_10_min)

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
