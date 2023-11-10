let count = 0
let interval
export default async function handler(req, res) {
	// console.log('before do')
	// if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
	// 	return res.status(401).end('Unauthorized')
	// }
	if (count == 0 && !interval) {
		count++
		await readSaveMeasurement()
		interval = setInterval(async () => {
			console.log(count)
			if (count++ >= 12) {
				clearInterval(interval)
				interval = null
				count = 0
			}

			await readSaveMeasurement()
		}, 5000)
	}
}
async function readSaveMeasurement() {
	const response = await $fetch('http://89.190.166.17:8081/v1/current_conditions').catch((error) =>
		console.log(error.data)
	)
	const { data: responseData } = await $fetch('/api/measurement', {
		method: 'post',
		body: {
			json: response,
		},
	})
}
