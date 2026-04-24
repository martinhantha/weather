import type { IMeasurement, IWeatherData, ICondition } from '~/types'

const emptyWeatherData: IWeatherData = { did: '', ts: 0, conditions: [] }

export const useMeasurement = (measurementToCalc: IMeasurement | null | undefined): IWeatherData => {
	const data = measurementToCalc?.json?.data
	if (!data) return emptyWeatherData

	let i = 0
	const weatherData: IWeatherData = {
		did: data.did ?? '',
		ts: data.ts ?? 0,
		conditions: [],
	}

	try {
		weatherData.ts = data.ts ?? 0
		const conditions = Array.isArray(data.conditions) ? data.conditions : []
		conditions.forEach((condition) => {
			weatherData.conditions[i] = { ...condition } as ICondition

			if (condition.temp) weatherData.conditions[i].temp = fahrenheitToCelcius(condition.temp)
			if (condition.dew_point) weatherData.conditions[i].dew_point = fahrenheitToCelcius(condition.dew_point)
			if (condition.wet_bulb) weatherData.conditions[i].wet_bulb = fahrenheitToCelcius(condition.wet_bulb)
			if (condition.heat_index) weatherData.conditions[i].heat_index = fahrenheitToCelcius(condition.heat_index)
			if (condition.wind_chill) weatherData.conditions[i].wind_chill = fahrenheitToCelcius(condition.wind_chill)
			if (condition.thw_index) weatherData.conditions[i].thw_index = fahrenheitToCelcius(condition.thw_index)
			if (condition.thsw_index) weatherData.conditions[i].thsw_index = fahrenheitToCelcius(condition.thsw_index)
			if (condition.wind_speed_last) weatherData.conditions[i].wind_speed_last = mpHToKmh(condition.wind_speed_last)
			if (condition.wind_speed_avg_last_1_min)
				weatherData.conditions[i].wind_speed_avg_last_1_min = mpHToKmh(condition.wind_speed_avg_last_1_min)
			if (condition.wind_speed_avg_last_2_min)
				weatherData.conditions[i].wind_speed_avg_last_2_min = mpHToKmh(condition.wind_speed_avg_last_2_min)
			if (condition.wind_speed_hi_last_2_min)
				weatherData.conditions[i].wind_speed_hi_last_2_min = mpHToKmh(condition.wind_speed_hi_last_2_min)
			if (condition.wind_speed_avg_last_10_min)
				weatherData.conditions[i].wind_speed_avg_last_10_min = mpHToKmh(condition.wind_speed_avg_last_10_min)
			if (condition.wind_speed_hi_last_10_min)
				weatherData.conditions[i].wind_speed_hi_last_10_min = mpHToKmh(condition.wind_speed_hi_last_10_min)

			i++
		})
	} catch (e) {
		console.log(e)
	}

	return weatherData
}

function fahrenheitToCelcius(num: number): number {
	return parseFloat(((5 / 9) * (num - 32)).toFixed(1))
}
function mpHToKmh(num: number): number {
	return parseInt((num * 1.609344).toFixed(0))
}
