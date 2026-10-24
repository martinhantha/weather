import mongoose, { Schema, model } from 'mongoose'

/** One raw wind reading per station and timestamp (currently Pioupiou, ~5 min cadence). */
const WindSampleSchema = new Schema(
	{
		station: { type: String, required: true },
		ts: { type: Number, required: true },
		min: Number,
		average: Number,
		max: Number,
		dir: Number,
	},
	{ collection: 'wind_history' }
)
WindSampleSchema.index({ station: 1, ts: 1 }, { unique: true })

export const WindSample =
	(mongoose.models as Record<string, ReturnType<typeof model>>)?.WindSample ??
	model('WindSample', WindSampleSchema, 'wind_history')
