<script setup lang="ts">
import type { useMeasurement } from '~/composables/measurment'

const { pending, data, refresh } = await useFetch('/api/measurement')
const maesurement = ref({ data })
const livedata = ref({})
const summ = 270
const degrees = ref('-135deg')
const degreesMax = ref('-135deg')
const direction = ref('0deg')
const directionScalar = ref('0deg')

onMounted(async () => {
	await refresh()
	await update()
	setInterval(async () => {
		await refresh()
		await update()
	}, 2000)
})
async function update() {
	livedata.value = useMeasurement(maesurement)
	direction.value = livedata.value.measurement.conditions[0].wind_dir_last + 'deg'
	degrees.value = (summ / 100) * livedata.value.measurement.conditions[0].wind_speed_last - 135 + 'deg'
	degreesMax.value = (summ / 100) * livedata.value.measurement.conditions[0].wind_speed_hi_last_10_min - 135 + 'deg'
	directionScalar.value =
		(summ / 100) * livedata.value.measurement.conditions[0].wind_dir_scalar_avg_last_10_min - 135 + 'deg'
}
</script>
<template>
	<div v-if="livedata?.measurement?.conditions">
		<!-- {{ maesurement.data.json }} -->
		<div class="py-1.5">
			{{ new Date(livedata?.measurement?.ts * 1000) }}
		</div>
		<div class="py-1.5">
			Aktuelle Wind: <strong>{{ livedata.measurement.conditions[0].wind_speed_last }}</strong> km/h
		</div>
		<div class="py-1.5">
			Durchschnitt Wind 10min:
			<strong>{{ livedata.measurement.conditions[0].wind_speed_avg_last_10_min }} </strong> km/h
		</div>
		<div class="py-1.5">
			Höchstwert Wind 10min: <strong>{{ livedata.measurement.conditions[0].wind_speed_hi_last_10_min }}</strong> km/h
		</div>
		<div class="py-1.5">
			Temperatur: <strong>{{ livedata.measurement.conditions[0].temp }}</strong> °C
		</div>
		<div class="py-1.5">
			Feuchtikeit: <strong>{{ livedata.measurement.conditions[0].hum }}</strong> %
		</div>
		<div class="py-1.5">
			Feuchtkugel: <strong>{{ livedata.measurement.conditions[0].wet_bulb }}</strong> °C
		</div>
	</div>
	<div class="outer flex py-6">
		<div class="direction">
			<div class="direction__wheel">
				<svg
					viewBox="0 0 800 800"
					version="1.1"
					xmlns="http://www.w3.org/2000/svg"
					xmlns:xlink="http://www.w3.org/1999/xlink"
				>
					<clipPath id="m">
						<path
							id="msk"
							d="m0-380 45,270 255,-190z m0,0 -45,270 -255,-190z m0,760 -45,-270 -255,190z m0,0 45,-270 255,190z"
						/>
						<use xlink:href="#msk" transform="rotate(90)" />
					</clipPath>
					<g transform="translate(400 400)" fill="none" stroke="#000">
						<circle r="300" />
						<g id="sca" stroke-linecap="round">
							<path d="M0,-300v-40 M0,300v40" stroke-width="2" />
							<path id="a" d="M0,-300v-20 M0,300v20" />
							<use xlink:href="#a" transform="rotate(5)" />
							<use xlink:href="#a" transform="rotate(10)" />
							<use xlink:href="#a" transform="rotate(15)" />
							<use xlink:href="#a" transform="rotate(20)" />
							<use xlink:href="#a" transform="rotate(25)" />
							<use xlink:href="#a" transform="rotate(30)" />
							<use xlink:href="#a" transform="rotate(35)" />
							<use xlink:href="#a" transform="rotate(40)" />
						</g>
						<use xlink:href="#sca" transform="rotate(45)" />
						<use xlink:href="#sca" transform="rotate(90)" />
						<use xlink:href="#sca" transform="rotate(135)" />
						<g fill="#000" stroke="#000" style="opacity: 0.23">
							<path d="m0,-65 155-90 -90,155 90,155 -155-90 -155,90 90,-155 -90,-155z" fill="#fff" />
							<path d="m0,0 0-65 155-90 -310,310 155-90 0-65 -65,0 -90-155 310,310 -90-155z" />
							<path d="m45-45 -45-255 -45,255 -255,45 255,45 45,255 45-255 255-45z" fill="#fff" />
							<path d="m0,0 -45-45 45-255 0,600 45-255 -45-45 -300,0 255,45 90-90 255,45z" />
						</g>
						<circle clip-path="url(#m)" stroke="#ccc" stroke-width="30" r="220" />
						<g font-family="Sans" font-size="18" text-anchor="middle" fill="#000" stroke="none">
							<text x="0" y="-380">
								N
								<tspan x="0" dy="22.5">360°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(45)">
								NO
								<tspan x="0" dy="22.5">45°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(90)">
								O
								<tspan x="0" dy="22.5">90°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(135)">
								SO
								<tspan x="0" dy="22.5">135°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(180)">
								S
								<tspan x="0" dy="22.5">180°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(225)">
								SW
								<tspan x="0" dy="22.5">225°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(270)">
								W
								<tspan x="0" dy="22.5">270°</tspan>
							</text>
							<text x="0" y="-380" transform="rotate(315)">
								NW
								<tspan x="0" dy="22.5">315°</tspan>
							</text>
						</g>
					</g>
				</svg>
			</div>
			<div class="pointer pointer-current"></div>
			<div class="pointer pointer-scalar"></div>
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
				<div class="pointer pointer-current"></div>
				<div class="pointer pointer-max"></div>
				<!-- <div class="endpoint"></div> -->
			</div>
		</div>
	</div>
</template>
<style lang="less">
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}
.outer {
	display: flex;
	justify-content: space-around;
	> div {
		max-width: 300px;
		max-width: 300px;
		svg {
			width: 100%;
			height: 300px;
		}
	}
}
.speed {
	position: relative;
	display: flex;
}
.direction {
	width: 300px;
	position: relative;
	.direction__wheel {
		z-index: 3;
		width: 100%;
	}
	.pointer {
		position: absolute;
		&.pointer-current {
			transform: rotate(v-bind(direction));
		}
		&.pointer-scalar {
			transform: rotate(v-bind(directionScalar));
			opacity: 0.4;
		}
	}
}
.speed__wheel {
	width: 300px;
	height: 300px;
	border-radius: 50%;
	background-color: #3f4140;
	clip-path: polygon(0% 0%, 100% 0%, 100% 90%, 0% 90%);
}
.speed__tick {
	display: flex;
	gap: 1px;
}

.tick {
	transform-origin: bottom;
	position: absolute;
	background: linear-gradient(to top, transparent 90%, white 90%);
	height: 140px;
	width: 2px;
	top: 10px;
	left: 50%;
	transform: rotate(var(--angle)) rotateZ(-145.5deg);
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
      --angle: calc(270deg / 20.5  * @value);
      --position-number: calc(145deg + (-13.2deg * @value));
   }
})
	.pointer {
	transition: all 2s;
	position: relative;
	background: #e66958;
	height: 190px;
	width: 20px;
	left: 140px;
	top: 3px;
	clip-path: polygon(9px 10px, 11px 10px, 20px 150px, 10px 190px, 0 150px);
	transform-origin: 10px 145px;
	&.pointer-current {
		transform: rotate(v-bind(degrees));
	}
	&.pointer-max {
		position: absolute;
		opacity: 0.4;
		transform: rotate(v-bind(degreesMax));
	}
}

.pointer::before {
	content: '';
	position: absolute;
	width: 10px;
	height: 10px;
	background: #f2f3f3;
	top: 140px;
	left: 5px;
	border-radius: 50%;
}

.endpoint {
	position: absolute;
	width: 7px;
	height: 7px;
	background: #f2f3f3;
	top: 225px;
	left: 235px;
	border-radius: 50%;
}
// LAYOUT mobile
@media (max-width: 1023px) {
	.outer {
		flex-direction: column;
		align-items: center;
		.direction {
			margin: 3rem 0;
		}
	}
	.temperatures {
		flex-direction: column;
	}
}
</style>
