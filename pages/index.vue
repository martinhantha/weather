<script setup lang="ts">
const { data: measurement, refresh } = await useFetch('/api/measurement')
setInterval(() => {
	refresh()
}, 2000)
</script>
<template>
	{{ measurement }}
	<div></div>
</template>
