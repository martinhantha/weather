<script setup lang="ts">
const { data: measurement } = await useFetch('/api/measurement')
</script>
<template>
	{{ measurement }}
	<div></div>
</template>
