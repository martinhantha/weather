<script setup lang="ts">
import type { useMeasurement } from '~/composables/measurment'

const { pending, data, refresh } = await useFetch('/api/measurement')
const maesurement = ref({ data })
const livedata = ref({})
const summ = 260
const degrees = ref('0deg')

onMounted(async () => {
	setInterval(async () => {
		await refresh()
		livedata.value = useMeasurement(maesurement)
		degrees.value = (summ / 120) * livedata.value.measurement.conditions[0].wind_speed_last - 130 + 'deg'
	}, 2000)
})
</script>
<template>
	<div v-if="livedata?.measurement?.conditions">
		<!-- {{ livedata.measurement.conditions[0] }} -->
		<div>Aktuelle Temperatur: {{ livedata.measurement.conditions[0].temp }} °C</div>
		<div>
			Aktuelle Wind: {{ livedata.measurement.conditions[0].wind_speed_last }} km/h -> Richtung:
			{{ livedata.measurement.conditions[0].wind_dir_last }}
		</div>
		<div>
			Durchschnit Wind 10min: {{ livedata.measurement.conditions[0].wind_speed_avg_last_10_min }} km/h -> Richtung:
			{{ livedata.measurement.conditions[0].wind_dir_scalar_avg_last_10_min }}
		</div>
		<div>
			Höchstwert Wind 10min: {{ livedata.measurement.conditions[0].wind_speed_hi_last_10_min }} km/h -> Richtung:
			{{ livedata.measurement.conditions[0].wind_dir_at_hi_speed_last_10_min }}
		</div>
	</div>
	<div class="speed">
		<div class="speed__wheel">
			<div class="speed__tick">
				<div class="tick" value="0"></div>
				<div class="tick" value="5"></div>
				<div class="tick" value="10"></div>
				<div class="tick" value="15"></div>
				<div class="tick" value="20"></div>
				<div class="tick" value="25"></div>
				<div class="tick" value="30"></div>
				<div class="tick" value="35"></div>
				<div class="tick" value="40"></div>
				<div class="tick" value="45"></div>
				<div class="tick" value="50"></div>
				<div class="tick" value="55"></div>
				<div class="tick" value="60"></div>
				<div class="tick" value="65"></div>
				<div class="tick" value="70"></div>
				<div class="tick" value="75"></div>
				<div class="tick" value="80"></div>
				<div class="tick" value="85"></div>
				<div class="tick" value="90"></div>
				<div class="tick" value="95"></div>
				<div class="tick" value="100"></div>
			</div>
			<div class="pointer"></div>
			<!-- <div class="endpoint"></div> -->
		</div>
	</div>
</template>
<style lang="less">
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

.speed {
	position: absolute;
	display: flex;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
}

.speed__wheel {
	width: 300px;
	height: 300px;
	border-radius: 50%;
	background-color: fade(#000, 30%);
	clip-path: polygon(0% 0%, 100% 0%, 100% 90%, 0% 90%);
}

.speed__tick {
	display: flex;
	gap: 1px;
}

.tick {
	transform-origin: bottom;
	position: absolute;
	background: linear-gradient(to top, transparent 90%, red 90%);
	height: 140px;
	width: 2px;
	top: 10px;
	left: 50%;
	transform: rotate(var(--angle)) rotateZ(-127deg);
}
.tick:nth-child(odd)::before {
	position: absolute;
	content: attr(value) '';
	color: #fff;
	left: -8px;
	top: 20px;
	z-index: 11;
	transform: rotate(var(--position-number));
}
each(range(22), {
   .tick:nth-child(@{value}) {
      --angle: calc(360deg / 31.5 * @value);
      --position-number: calc(130deg + (-11.6deg * @value));
   }
})
	.pointer {
	transition: all 2s;
	position: relative;
	background: yellow;
	height: 190px;
	width: 20px;
	left: 140px;
	top: 3px;
	clip-path: polygon(9px 10px, 11px 10px, 20px 150px, 10px 190px, 0 150px);
	transform-origin: 10px 145px;
	transform: rotate(v-bind(degrees));
}

.pointer::before {
	content: '';
	position: absolute;
	width: 10px;
	height: 10px;
	background: gray;
	top: 140px;
	left: 5px;
	border-radius: 50%;
}

.endpoint {
	position: absolute;
	width: 7px;
	height: 7px;
	background: grey;
	top: 225px;
	left: 235px;
	border-radius: 50%;
}

@keyframes animate-pointer {
	0% {
		transform: rotate(-130deg);
	}
	80% {
		transform: rotate(120deg);
	}
	100% {
		transform: rotate(-130deg);
	}
}
</style>
