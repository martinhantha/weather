import { useScheduler } from '#scheduler'
export default defineNitroPlugin(async (nitroApp) => {
	// console.log('Nitro plugin', nitroApp)
	await startScheduler()
})

async function startScheduler() {
	const scheduler = useScheduler()

	scheduler
		.run(async () => {
			await readSaveMeasurement()
		})
		.everySeconds(2)
}

async function readSaveMeasurement() {
	const response = await $fetch('http://89.190.166.17:8081/v1/current_conditions').catch((error) =>
		console.log(error.data)
	)

	const responseData = await $fetch('/api/measurement', {
		method: 'post',
		body: {
			json: response,
		},
	})
}
