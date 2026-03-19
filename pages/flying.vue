<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type FlightHour = {
  time: string
  windSpeed: number | null
  windDirection: number | null
  gusts: number | null
  cloudCover: number | null
  lowCloudCover: number | null
  precipitation: number | null
  cape: number | null
  score: number
  rating: 'gut' | 'ok' | 'kritisch'
  reasons: string[]
  freezingLevel: number | null
}

type FlightWeatherResponse = {
  source: string
  location: {
    latitude: number
    longitude: number
    elevation: number | null
    timezone: string
  }
  hours: FlightHour[]
}

const lat = ref(46.4983) // Beispiel: Meran
const lon = ref(11.3548)
const elevation = ref(1500) // z. B. Startplatzhöhe
const timezone = ref('Europe/Rome')

const apiUrl = computed(
  () => `/api/flight-weather?lat=${lat.value}&lon=${lon.value}&elevation=${elevation.value}&timezone=${timezone.value}`,
)

const { data, pending, error, refresh } = await useFetch<FlightWeatherResponse>(apiUrl)

const hours = computed<FlightHour[]>(() => (data.value?.hours ?? []) as FlightHour[])

const bestHours = computed(() => {
  return [...hours.value]
    .filter((h) => h.rating !== 'kritisch')
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
})

const selectedHour = ref<FlightHour | null>(null)

watch(
  () => [bestHours.value.length, hours.value.length],
  () => {
    if (selectedHour.value) return
    selectedHour.value = bestHours.value[0] ?? hours.value[0] ?? null
  },
  { immediate: true },
)

function formatTime(time: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone.value,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time))
}

function formatHour(time: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone.value,
    hour: '2-digit',
  }).format(new Date(time))
}

function dateKey(time: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone.value,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time))
}

function formatDayLabel(time: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone.value,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(time))
}

function scoreToThermalColor(score: number): string {
  // red -> green
  const t = Math.max(0, Math.min(1, score / 100))
  const hue = 120 * t
  return `hsl(${hue} 85% 45%)`
}

function scoreToTextColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100))
  return t >= 0.52 ? '#052e16' : '#ffffff'
}

function ratingBadgeClass(rating: FlightHour['rating']): string {
  if (rating === 'gut') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (rating === 'ok') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-rose-200 bg-rose-50 text-rose-800'
}

const dayGroups = computed(() => {
  const groups = new Map<string, { key: string; dayLabel: string; hours: FlightHour[] }>()
  for (const h of hours.value) {
    const key = dateKey(h.time)
    const existing = groups.get(key)
    if (existing) {
      existing.hours.push(h)
      continue
    }
    groups.set(key, {
      key,
      dayLabel: formatDayLabel(h.time),
      hours: [h],
    })
  }
  return [...groups.values()]
})
</script>

<template>
  <div class="mx-auto max-w-5xl p-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900">Paragliding Forecast</h1>
      <p class="mt-1 text-sm text-gray-600">Thermal view heatmap + best time windows.</p>
    </header>

    <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label class="space-y-1">
          <span class="text-xs font-medium text-gray-500">Lat</span>
          <input v-model.number="lat" type="number" step="0.0001" class="w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm" />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-medium text-gray-500">Lon</span>
          <input v-model.number="lon" type="number" step="0.0001" class="w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm" />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-medium text-gray-500">Elevation</span>
          <input v-model.number="elevation" type="number" step="1" class="w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm" />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-medium text-gray-500">Timezone</span>
          <input v-model="timezone" type="text" class="w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm" />
        </label>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          @click="() => refresh()"
        >
          Neu laden
        </button>

        <div v-if="selectedHour" class="text-sm text-gray-600">
          Aktuell ausgewählt: <span class="font-semibold tabular-nums">{{ formatTime(selectedHour.time) }}</span>
          <span class="text-gray-400">·</span>
          <span :class="ratingBadgeClass(selectedHour.rating)" class="inline-flex items-center rounded-full border px-2 py-0.5 font-semibold">
            {{ selectedHour.rating }} ({{ selectedHour.score }})
          </span>
        </div>
      </div>
    </section>

    <section class="mt-6">
      <p v-if="pending" class="text-center text-sm text-gray-500">Lade Wetterdaten …</p>
      <p v-else-if="error" class="text-center text-sm text-red-600">Fehler: {{ error?.message }}</p>

      <template v-else>
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-gray-900">Thermal view</h2>
              <div class="text-xs text-gray-500">Klicken für Details</div>
            </div>

            <div class="mb-3 flex flex-wrap items-center gap-4 text-sm">
              <span class="inline-flex items-center gap-2">
                <span class="h-3.5 w-3.5 rounded bg-rose-500" />
                Kritisch
              </span>
              <span class="inline-flex items-center gap-2">
                <span class="h-3.5 w-3.5 rounded bg-amber-500" />
                Ok
              </span>
              <span class="inline-flex items-center gap-2">
                <span class="h-3.5 w-3.5 rounded bg-emerald-600" />
                Gut
              </span>
            </div>

            <div class="thermal-scroll overflow-x-auto rounded-lg border border-gray-100 bg-gray-50 p-2">
              <div class="min-w-max space-y-2">
                <div v-for="group in dayGroups" :key="group.key" class="flex items-start gap-2">
                  <div class="w-20 shrink-0 pt-1 text-xs font-medium text-gray-600">{{ group.dayLabel }}</div>
                  <div class="flex items-stretch gap-[3px]">
                    <button
                      v-for="hour in group.hours"
                      :key="hour.time"
                      type="button"
                      class="thermal-cell"
                      :class="{ 'thermal-cell--selected': selectedHour?.time === hour.time }"
                      :style="{ backgroundColor: scoreToThermalColor(hour.score), color: scoreToTextColor(hour.score) }"
                      :title="`${formatTime(hour.time)} · ${hour.rating} · Score ${hour.score}`"
                      @click="selectedHour = hour"
                    >
                      <span class="thermal-cell__hour">{{ formatHour(hour.time) }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 class="text-lg font-semibold text-gray-900">Details</h2>

            <div v-if="selectedHour" class="mt-3 space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <div class="text-xs uppercase tracking-wide text-gray-500">Zeit</div>
                <div class="text-sm font-semibold tabular-nums text-gray-900">
                  {{ formatTime(selectedHour.time) }}
                </div>
              </div>

              <div class="flex items-baseline justify-between gap-3">
                <div class="text-xs uppercase tracking-wide text-gray-500">Bewertung</div>
                <div :class="ratingBadgeClass(selectedHour.rating)" class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold">
                  {{ selectedHour.rating }} · Score {{ selectedHour.score }}
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Wind</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.windSpeed ?? '—' }} km/h
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Böen</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.gusts ?? '—' }} km/h
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Richtung</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.windDirection ?? '—' }}°
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Niederschlag</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.precipitation ?? '—' }} mm
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Bewölkung</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.cloudCover ?? '—' }} %
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Tiefbewölkung</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.lowCloudCover ?? '—' }} %
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3 col-span-2">
                  <div class="text-xs text-gray-500">CAPE</div>
                  <div class="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {{ selectedHour.cape ?? '—' }}
                  </div>
                </div>
              </div>

              <div v-if="selectedHour.reasons?.length" class="rounded-lg border border-gray-100 bg-white p-3">
                <div class="text-xs uppercase tracking-wide text-gray-500">Warum diese Bewertung?</div>
                <ul class="mt-1 list-disc pl-5 text-sm text-gray-700">
                  <li v-for="r in selectedHour.reasons" :key="r">{{ r }}</li>
                </ul>
              </div>
            </div>

            <div v-else class="mt-3 text-sm text-gray-500">
              Wähle ein Zeitfenster in der Thermal View.
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-gray-900">Beste Zeitfenster</h2>
            <div class="text-sm text-gray-500">Top {{ bestHours.length }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="hour in bestHours"
              :key="hour.time"
              type="button"
              class="rounded-lg border px-3 py-2 text-sm transition hover:border-sky-300"
              :class="selectedHour?.time === hour.time ? 'border-sky-500 bg-sky-50' : 'bg-white'"
              @click="selectedHour = hour"
            >
              <div class="flex items-center gap-2">
                <span class="font-semibold tabular-nums">{{ formatTime(hour.time) }}</span>
                <span :class="ratingBadgeClass(hour.rating)" class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                  {{ hour.rating }}
                </span>
              </div>
              <div class="mt-1 text-xs text-gray-600">Score {{ hour.score }} · Wind {{ hour.windSpeed ?? '—' }} km/h</div>
            </button>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 class="text-lg font-semibold text-gray-900">Alle Stunden</h2>
          <div class="mt-3 overflow-x-auto rounded-lg border border-gray-100">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th class="px-3 py-2">Zeit</th>
                  <th class="px-3 py-2">Bewertung</th>
                  <th class="px-3 py-2">Score</th>
                  <th class="px-3 py-2">Wind</th>
                  <th class="px-3 py-2">Richtung</th>
                  <th class="px-3 py-2">Böen</th>
                  <th class="px-3 py-2">Bewölkung</th>
                  <th class="px-3 py-2">Tiefbewölkung</th>
                  <th class="px-3 py-2">Niederschlag</th>
                  <th class="px-3 py-2">CAPE</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="hour in hours" :key="hour.time" class="hover:bg-gray-50">
                  <td class="px-3 py-2 tabular-nums">{{ formatTime(hour.time) }}</td>
                  <td class="px-3 py-2">
                    <span :class="ratingBadgeClass(hour.rating)" class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                      {{ hour.rating }}
                    </span>
                  </td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.score }}</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.windSpeed ?? '—' }} km/h</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.windDirection ?? '—' }}°</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.gusts ?? '—' }} km/h</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.cloudCover ?? '—' }} %</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.lowCloudCover ?? '—' }} %</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.precipitation ?? '—' }} mm</td>
                  <td class="px-3 py-2 tabular-nums">{{ hour.cape ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.thermal-cell {
    width: 18px;
    min-width: 18px;
    height: 34px;
    border-radius: 7px;
    border: 1px solid rgba(15, 23, 42, 0.12);
    box-shadow: inset 0 -10px 18px rgba(255, 255, 255, 0.12);
    cursor: pointer;
    padding: 0 0 4px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.thermal-cell:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.12);
    border-color: rgba(56, 189, 248, 0.6);
}

.thermal-cell--selected {
    border-color: rgba(59, 130, 246, 0.85);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18), 0 16px 30px rgba(0, 0, 0, 0.14);
}

.thermal-cell__hour {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1;
    user-select: none;
}
</style>