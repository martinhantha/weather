<script setup lang="ts">
import type { Measurement } from '~/types'

// const { findOne } = useStrapi()
// const response2 = await findOne('measurements', '1')
const response = await $fetch<Measurement>('http://localhost:1337/api/measurements').catch((error) => error.data)
</script>
<template>
	{{ response }}
	<div>
		<NuxtWelcome />
	</div>
</template>
