export interface ICondition {
	lsid: number
	data_structure_type: number
	txid?: number
	temp?: number
	hum?: number
	dew_point?: number
	wet_bulb?: number
	heat_index?: number
	wind_chill?: number
	thw_index?: number
	thsw_index?: number
	wind_speed_last?: number
	wind_dir_last?: number
	wind_speed_avg_last_1_min?: number
	wind_dir_scalar_avg_last_1_min?: number
	wind_speed_avg_last_2_min?: number
	wind_dir_scalar_avg_last_2_min?: number
	wind_speed_hi_last_2_min?: number
	wind_dir_at_hi_speed_last_2_min?: number
	wind_speed_avg_last_10_min?: number
	wind_dir_scalar_avg_last_10_min?: number
	wind_speed_hi_last_10_min?: number
	wind_dir_at_hi_speed_last_10_min?: number
	rain_size?: number
	rain_rate_last?: number
	rain_rate_hi?: number
	rainfall_last_15_min?: number
	rain_rate_hi_last_15_min?: number
	rainfall_last_60_min?: number
	rainfall_last_24_hr?: number
	rain_storm?: number
	rain_storm_start_at?: number
	solar_rad?: number
	uv_index?: number
	rx_state?: number
	trans_battery_flag?: number
	rainfall_daily?: number
	rainfall_monthly?: number
	rainfall_year?: number
	rain_storm_last?: number
	rain_storm_last_start_at?: number
	rain_storm_last_end_at?: number
	temp_in?: number
	hum_in?: number
	dew_point_in?: number
	heat_index_in?: number
	bar_sea_level?: number
	bar_trend?: number
	bar_absolute?: number
}
export interface IWeatherData {
	did: string
	ts: number
	conditions: ICondition[]
}

export interface IApiResponse {
	data: IWeatherData
	error: any
}
export interface IMeasurement {
   _id: ObjectId
	json: IApiResponse
   timeid?: string
   createdAt?: Date
   updatedAt?: Date
}

/** South Tyrol Buergernetz API: one row per sensor type. */
export interface ISouthTyrolSensorRow {
	TYPE: string
	VALUE: number
	DATE: string
}

/** Normalized South Tyrol station (same field names as ICondition for display/gauges). */
export interface INormalizedSouthTyrolStation {
	ts: number
	temp?: number
	wind_speed_last?: number
	wind_speed_hi_last_10_min?: number
	wind_speed_avg_last_10_min?: number
	wind_dir_last?: number
}

/** Station config for wind list: WeatherLink, South Tyrol, PWS (weather.com), or Weathercloud. */
export interface IStationConfig {
	id: string
	name: string
	source: 'weatherlink' | 'southtyrol' | 'pws' | 'weathercloud'
	station_id?: string
	station_code?: string
}
