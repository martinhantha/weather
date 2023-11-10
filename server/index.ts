import mongoose from 'mongoose'
const config = useRuntimeConfig()
export default async () => {
	try {
		await mongoose.connect(config.mongoUrl)
		console.log('DB connection established.')
	} catch (err) {
		console.error.error('DB connection failed.', err)
	}
}
