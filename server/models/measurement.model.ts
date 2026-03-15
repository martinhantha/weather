import mongoose, { Schema, model } from 'mongoose'

const MeasurementSchema = new Schema(
	{
		timeid: String,
		json: Schema.Types.Mixed,
	},
	{ collection: 'measurement' }
)

export const Measurement =
	(mongoose.models as Record<string, ReturnType<typeof model>>)?.Measurement ??
	model('Measurement', MeasurementSchema, 'measurement')
