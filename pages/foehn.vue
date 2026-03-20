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

function formatAxisTime(iso: string) {
    return new Date(iso).toLocaleString('de-AT', {
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatDayLabel(iso: string) {
    return new Date(iso).toLocaleDateString('de-AT', {
        timeZone: 'Europe/Vienna',
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
    })
}

const chart = computed(() => {
    const rows = series.value?.rows ?? []
    if (!rows.length) return null

    const nums: number[] = []
    for (const r of rows) {
        if (r.observation != null) nums.push(r.observation)
        if (r.pastForecast != null) nums.push(r.pastForecast)
        if (r.forecast != null) nums.push(r.forecast)
    }
    if (!nums.length) return null

    let minY = Math.min(...nums, 0)
    let maxY = Math.max(...nums, 0)
    if (minY === maxY) {
        minY -= 1
        maxY += 1
    }
    const padY = (maxY - minY) * 0.08
    minY -= padY
    maxY += padY

    const w = 1000
    const h = 340
    const pl = 52
    const pr = 28
    const pt = 28
    const pb = 52
    const innerW = w - pl - pr
    const innerH = h - pt - pb
    const n = rows.length

    const xAt = (i: number) => pl + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const yAt = (v: number) =>
        pt + innerH - ((v - minY) / (maxY - minY)) * innerH

    const obsPts: [number, number][] = []
    const pastFcPts: [number, number][] = []
    const fcPts: [number, number][] = []
    rows.forEach((r, i) => {
        if (r.observation != null) obsPts.push([xAt(i), yAt(r.observation)])
        if (r.pastForecast != null) pastFcPts.push([xAt(i), yAt(r.pastForecast)])
        if (r.forecast != null) fcPts.push([xAt(i), yAt(r.forecast)])
    })

    const toPath = (pts: [number, number][]) => {
        if (!pts.length) return ''
        let d = `M ${pts[0][0]} ${pts[0][1]}`
        for (let k = 1; k < pts.length; k++) d += ` L ${pts[k][0]} ${pts[k][1]}`
        return d
    }

    const zeroInRange = 0 >= minY && 0 <= maxY
    const yZero = zeroInRange ? yAt(0) : null

    type Pt = { x: number; y: number; v: number }

    /** Punkte entlang einer Serie inkl. Schnittpunkte mit Δp = 0 zwischen benachbarten Stützstellen */
    const ptsWithZeroCrossings = (
        key: 'observation' | 'forecast',
    ): Pt[] => {
        const indices: number[] = []
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][key] != null) indices.push(i)
        }
        const out: Pt[] = []
        for (let k = 0; k < indices.length; k++) {
            const i = indices[k]
            const v = rows[i][key]!
            if (k > 0 && yZero != null) {
                const i0 = indices[k - 1]
                const v0 = rows[i0][key]!
                if (v0 * v < 0) {
                    const t = v0 / (v0 - v)
                    const xZ = xAt(i0) + t * (xAt(i) - xAt(i0))
                    out.push({ x: xZ, y: yZero, v: 0 })
                }
            }
            out.push({ x: xAt(i), y: yAt(v), v })
        }
        return out
    }

    /** Fläche nur zwischen y = yZero und der Kurve (positive bzw. negative Δp-Segmente) */
    const pathsBetweenCurveAndZero = (pts: Pt[], positive: boolean): string => {
        if (yZero == null) return ''
        const parts: string[] = []
        let run: Pt[] = []
        /** Bei v=0 (Null-Schnitt) muss die Basis bei crossing.x schließen, nicht bei last curve x */
        const flush = (closingX?: number) => {
            if (!run.length) return
            const xBase = closingX ?? run[run.length - 1].x
            let d = `M ${run[0].x} ${yZero} L ${run[0].x} ${run[0].y}`
            for (let k = 1; k < run.length; k++) d += ` L ${run[k].x} ${run[k].y}`
            d += ` L ${xBase} ${yZero} Z`
            parts.push(d)
            run = []
        }
        for (const p of pts) {
            if (positive ? p.v > 0 : p.v < 0) {
                run.push(p)
            } else if (p.v === 0) {
                flush(p.x)
            } else {
                flush()
            }
        }
        flush()
        return parts.join(' ')
    }

    /** Rot für Δp &gt; 0: Beobachtung (Analyse) und Vorhersage – nur Obs würde positives Föhn im Prognoseteil auslassen */
    const fillPositiveRedPath =
        yZero != null
            ? [
                  pathsBetweenCurveAndZero(
                      ptsWithZeroCrossings('observation'),
                      true,
                  ),
                  pathsBetweenCurveAndZero(
                      ptsWithZeroCrossings('forecast'),
                      true,
                  ),
              ]
                  .filter((s) => s.length > 0)
                  .join(' ')
            : ''
    const fillFcBelowPath =
        yZero != null
            ? pathsBetweenCurveAndZero(ptsWithZeroCrossings('forecast'), false)
            : ''

    const yTicks = 5
    const tickVals: number[] = []
    for (let t = 0; t <= yTicks; t++) {
        tickVals.push(minY + (t / yTicks) * (maxY - minY))
    }

    const xTickIdx = [0, Math.floor((n - 1) / 2), n - 1].filter(
        (v, i, a) => a.indexOf(v) === i
    )

    /** Mitternacht in lokaler Zeit (Open-Meteo: …T00:00) */
    const midnightX: number[] = []
    const midnightIndices: number[] = []
    rows.forEach((r, i) => {
        if (/T00:00(:00)?$/.test(r.time)) {
            midnightX.push(xAt(i))
            midnightIndices.push(i)
        }
    })

    /** Label-x = Mitte zwischen zwei aufeinanderfolgenden Mitternächten (letztes Segment: bis Serienende) */
    const xEnd = pl + innerW
    const midnightLabels: { x: number; time: string }[] = midnightIndices.map((idx, k) => {
        const xStart = xAt(idx)
        const xNext = k + 1 < midnightIndices.length ? xAt(midnightIndices[k + 1]) : xEnd
        return { x: (xStart + xNext) / 2, time: rows[idx].time }
    })

    /** Ersten (unvollständigen) Tag: Serienanfang bis erste Mitternacht */
    if (midnightIndices.length > 0 && midnightIndices[0] > 0) {
        const xFirst = pl
        const xMid = (xFirst + xAt(midnightIndices[0])) / 2
        midnightLabels.unshift({ x: xMid, time: rows[0].time })
    }

    return {
        w,
        h,
        midnightX,
        midnightLabels,
        minY,
        maxY,
        obsPath: toPath(obsPts),
        pastFcPath: toPath(pastFcPts),
        fcPath: toPath(fcPts),
        yZero,
        fillPositiveRedPath,
        fillFcBelowPath,
        zeroInRange,
        tickVals,
        yAt,
        pl,
        pr,
        pt,
        pb,
        innerW,
        innerH,
        xTickIdx,
        rows,
    }
})
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
          v-if="chart"
          class="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <svg
            class="h-auto w-full max-h-[min(420px,55vh)]"
            :viewBox="`0 0 ${chart.w} ${chart.h}`"
            role="img"
            aria-label="Diagramm Druckdifferenz Bozen minus Innsbruck: Analyse, Modell gleicher Lauf violett und blau, Vorhersage Zukunft"
          >
            <rect
              :x="chart.pl"
              :y="chart.pt"
              :width="chart.innerW"
              :height="chart.innerH"
              fill="#f8fafc"
              stroke="#e2e8f0"
              stroke-width="1"
            />

            <!-- Fläche zwischen Δp = 0 und Kurve: rot wenn Δp &gt; 0 (Beobachtung + Vorhersage), blau wenn Δp &lt; 0 (nur Vorhersage) -->
            <path
              v-if="chart.fillPositiveRedPath"
              :d="chart.fillPositiveRedPath"
              fill="rgb(244 63 94 / 0.35)"
              pointer-events="none"
            />
            <path
              v-if="chart.fillFcBelowPath"
              :d="chart.fillFcBelowPath"
              fill="rgb(14 165 233 / 0.35)"
              pointer-events="none"
            />

            <!-- Y grid -->
            <g>
              <line
                v-for="(tv, gi) in chart.tickVals"
                :key="'h' + gi"
                :x1="chart.pl"
                :x2="chart.pl + chart.innerW"
                :y1="chart.yAt(tv)"
                :y2="chart.yAt(tv)"
                stroke="#cbd5e1"
                stroke-dasharray="4 4"
                stroke-width="1"
              />
            </g>

            <!-- Mitternacht (lokal, Europe/Vienna): sehr dünne Vertikale -->
            <g>
              <line
                v-for="(mx, mi) in chart.midnightX"
                :key="'mid' + mi"
                :x1="mx"
                :x2="mx"
                :y1="chart.pt"
                :y2="chart.pt + chart.innerH"
                stroke="#94a3b8"
                stroke-opacity="0.55"
                stroke-width="0.45"
              />
            </g>

            <!-- Zero line -->
            <line
              v-if="chart.yZero != null"
              :x1="chart.pl"
              :x2="chart.pl + chart.innerW"
              :y1="chart.yZero"
              :y2="chart.yZero"
              stroke="#059669"
              stroke-width="2"
            />

            <!-- Y axis labels -->
            <g
              class="fill-slate-500"
              font-family="system-ui, sans-serif"
              font-size="11"
              text-anchor="end"
            >
              <text
                v-for="(tv, gi) in chart.tickVals"
                :key="'yl' + gi"
                :x="chart.pl - 8"
                :y="chart.yAt(tv)"
                dominant-baseline="middle"
              >
                {{ tv.toFixed(1) }}
              </text>
            </g>

            <!-- X axis labels: Wochentag + Datum an jeder Mitternacht -->
            <g
              class="fill-slate-600"
              font-family="system-ui, sans-serif"
              font-size="11"
              text-anchor="middle"
            >
              <text
                v-for="ml in chart.midnightLabels"
                :key="'mid-lbl-' + ml.time"
                :x="ml.x"
                :y="chart.h - 18"
              >
                {{ formatDayLabel(ml.time) }}
              </text>
            </g>

            <!-- Y unit -->
            <text
              class="fill-slate-500"
              font-family="system-ui, sans-serif"
              font-size="11"
              :x="chart.pl"
              :y="14"
            >
              Δp (hPa)
            </text>


            <!-- Future forecast (blue) -->
            <path
              v-if="chart.fcPath"
              :d="chart.fcPath"
              fill="none"
              stroke="#0284c7"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Observation (rose) -->
            <path
              v-if="chart.obsPath"
              :d="chart.obsPath"
              fill="none"
              stroke="#e11d48"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
            <span class="inline-flex items-center gap-2">
              <span class="inline-block h-0.5 w-6 bg-rose-600" />
              Beobachtung
            </span>
            <span class="inline-flex items-center gap-2">
              <span class="inline-block h-0.5 w-6 bg-sky-600" />
              Vorhersage Zukunft
            </span>
            <span class="inline-flex items-center gap-2">
              <span class="inline-block h-3 w-3 rounded-sm bg-emerald-600" />
              Δp = 0
            </span>
          </div>
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
