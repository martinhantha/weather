import { Schema, model } from 'mongoose'
import bcrypt from 'mongoose-bcrypt'

const schema = new Schema(
	{
		email: { type: String, unique: true },
		password: { type: String, bcrypt: true },
		name: String,
	},
	{ timestamps: true, strict: true, strictQuery: true }
)
// schema.plugin(bcrypt)
export const User = model('User', schema, 'user')
