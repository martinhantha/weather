<script setup lang="ts">
import type { useMeasurement } from '~/composables/measurment'

const { pending, data, refresh } = await useFetch('/api/measurement')
const mesurement = ref({ data })

onMounted(async () => {
	setInterval(async () => {
		await refresh()
		mesurement.data = useMeasurement(mesurement.value.data.json.data)
	}, 2000)
})
</script>
<template>
	{{ mesurement.data }}
	<div></div>
</template>
