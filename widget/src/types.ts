export interface ICondition {
    // Values used by the widget (kept intentionally minimal).
    temp?: number
    wind_speed_last?: number
    wind_dir_last?: number
    wind_speed_hi_last_10_min?: number
    wind_speed_avg_last_10_min?: number
}

export interface IStationConfig {
    id: string
    name: string
    source: 'weatherlink' | 'southtyrol' | 'pws'
    station_id?: string
    station_code?: string
}

