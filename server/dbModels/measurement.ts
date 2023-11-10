import mongoose from 'mongoose'
import bcrypt from 'mongoose-bcrypt'
const schema = new mongoose.Schema(
	{
		json: { type: Object},
	},
	{ timestamps: true, strict: true, strictQuery: true }
)
schema.plugin(bcrypt)
export default mongoose.model('Measurement', schema, 'measurement')
