import mongoose, { Schema, model, models } from 'mongoose'
import { IApiResponse, ICondition, IMeasurement, IWeatherData } from '~/types'

const ConditionSchema: Schema = new Schema({
	lsid: Number,
	data_structure_type: Number,
	txid: Number,
	temp: Number,
	hum: Number,
	dew_point: Number,
	wet_bulb: Number,
	heat_index: Number,
	wind_chill: Number,
	thw_index: Number,
	thsw_index: Number,
	wind_speed_last: Number,
	wind_dir_last: Number,
	wind_speed_avg_last_1_min: Number,
	wind_dir_scalar_avg_last_1_min: Number,
	wind_speed_avg_last_2_min: Number,
	wind_dir_scalar_avg_last_2_min: Number,
	wind_speed_hi_last_2_min: Number,
	wind_dir_at_hi_speed_last_2_min: Number,
	wind_speed_avg_last_10_min: Number,
	wind_dir_scalar_avg_last_10_min: Number,
	wind_speed_hi_last_10_min: Number,
	wind_dir_at_hi_speed_last_10_min: Number,
	rain_size: Number,
	rain_rate_last: Number,
	rain_rate_hi: Number,
	rainfall_last_15_min: Number,
	rain_rate_hi_last_15_min: Number,
	rainfall_last_60_min: Number,
	rainfall_last_24_hr: Number,
	rain_storm: Number,
	rain_storm_start_at: Number,
	solar_rad: Number,
	uv_index: Number,
	rx_state: Number,
	trans_battery_flag: Number,
	rainfall_daily: Number,
	rainfall_monthly: Number,
	rainfall_year: Number,
	rain_storm_last: Number,
	rain_storm_last_start_at: Number,
	rain_storm_last_end_at: Number,
	temp_in: Number,
	hum_in: Number,
	dew_point_in: Number,
	heat_index_in: Number,
	bar_sea_level: Number,
	bar_trend: Number,
	bar_absolute: Number,
})

const WeatherDataSchema: Schema = new Schema({
	did: String,
	ts: Number,
	conditions: [ConditionSchema],
})

const ApiResponseSchema: Schema = new Schema({
	data: WeatherDataSchema,
	error: Schema.Types.Mixed,
})

const MeasurementSchema: Schema = new Schema({
	_id: Schema.Types.ObjectId,
	json: ApiResponseSchema,
	timeid: String,
	createdAt: Date,
	updatedAt: Date,
})

export const Condition = mongoose.models?.Condition || model<ICondition>('Condition', ConditionSchema)
export const WeatherData = mongoose.models?.WeatherData || model<IWeatherData>('WeatherData', WeatherDataSchema)
export const ApiResponse = mongoose.models?.ApiResponse || model<IApiResponse>('ApiResponse', ApiResponseSchema)
export const Measurement = mongoose.models?.Measurement || model<IMeasurement>('Measurement', MeasurementSchema, 'measurement')
