<script setup lang="ts">
type SeriesRow = {
    time: string
    observation: number | null
    pastForecast: number | null
    forecast: number | null
}

const { data, pending, error, refresh } = await useFetch<{
    generatedAt?: string
    bolzanoPressure?: number | null
    innsbruckPressure?: number | null
    differenceStation?: number | null
    differenceModel?: number | null
    interpretation?: string | null
}>('/api/foehn-diff')
const {
    data: series,
    pending: seriesPending,
    error: seriesError,
    refresh: refreshSeries,
} = await useFetch<{
    rows: SeriesRow[]
    note?: string
    timezone?: string
    pastHours?: number
    forecastHours?: number
    generatedAt?: string
}>('/api/foehn-series')

const loading = computed(() => pending.value || seriesPending.value)
const loadError = computed(() => error.value || seriesError.value)

async function reload() {
    await Promise.all([refresh(), refreshSeries()])
}

/** Zeitpunkt des Server-Abrufs / der Berechnung (Diagramm-Zeitreihe hat Vorrang) */
const calculationInstant = computed(
    () => series.value?.generatedAt ?? data.value?.generatedAt ?? ''
)

function formatCalculationTime(iso: string) {
    if (!iso) return '–'
    return new Date(iso).toLocaleString('de-AT', {
        timeZone: 'Europe/Vienna',
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })
}

const POLL_MS = 5 * 60 * 1000
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') reload()
    }, POLL_MS)
})

onBeforeUnmount(() => {
    if (pollTimer != null) {
        clearInterval(pollTimer)
        pollTimer = null
    }
})

const foehnRows = computed(() => series.value?.rows ?? [])
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <h1 class="mb-6 text-2xl font-semibold text-slate-900">
      Druckdifferenz Bozen–Innsbruck
    </h1>

    <p
      v-if="!loadError && calculationInstant"
      class="mb-4 text-sm text-slate-500"
    >
      <strong class="font-medium text-slate-600">Stand der Berechnung:</strong>
      {{ formatCalculationTime(calculationInstant) }}
    </p>

    <p v-if="loading">Lade…</p>
    <p v-else-if="loadError">Fehler beim Laden.</p>

    <template v-else>
      <section class="mb-8 space-y-2 text-slate-800">
        <!-- <p>
          <strong class="text-slate-600">Bozen:</strong>
          {{ data?.bolzanoPressure ?? '–' }} hPa
        </p>
        <p>
          <strong class="text-slate-600">Innsbruck:</strong>
          {{ data?.innsbruckPressure ?? '–' }} hPa
        </p> -->
        <p>
          Δp Station (Bozen − Innsbruck):
          <strong>{{ data?.differenceStation ?? '–' }} hPa</strong>
        </p>
      </section>

      <section class="mb-4">
        <!-- <h2 class="mb-2 text-lg font-medium text-slate-800">
          Zeitreihe ({{ series?.pastHours ?? 24 }} h Analyse ·
          {{ series?.forecastHours ?? 96 }} h Vorhersage)
        </h2> -->
        <!-- <p class="mb-3 max-w-prose text-xs text-slate-600">
          {{ series?.note }}
        </p> -->

        <div
          v-if="foehnRows.length"
          class="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <FoehnPressureChart :rows="foehnRows" />
        </div>
      </section>
<!-- 
      <button
        type="button"
        class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
        @click="reload()"
      >
        Neu laden
      </button> -->
    </template>
  </div>
</template>
