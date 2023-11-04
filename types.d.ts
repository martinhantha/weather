export interface Measurement {
   data: Daum[]
   meta: Meta
 }
 
 export interface Daum {
   id: number
   attributes: Attributes
 }
 
 export interface Attributes {
   data: Data
   createdAt: string
   updatedAt: string
   publishedAt: string
 }
 
 export interface Data {
   data: Data2
   error: any
 }
 
 export interface Data2 {
   did: string
   ts: number
   conditions: Condition[]
 }
 
 export interface Condition {
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
   thsw_index: any
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
   rain_storm_start_at: any
   solar_rad: any
   uv_index: any
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
 
 export interface Meta {
   pagination: Pagination
 }
 
 export interface Pagination {
   page: number
   pageSize: number
   pageCount: number
   total: number
 }
 