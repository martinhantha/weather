<script setup lang="ts">
import { computed } from 'vue'

type SeriesRow = {
    time: string
    observation: number | null
    pastForecast: number | null
    forecast: number | null
}

const props = defineProps<{
    rows: SeriesRow[]
    /** Extra CSS classes forwarded to the wrapping div */
    class?: string
    /** Font size for axis / label text inside the SVG (default 11) */
    fontSize?: number
}>()

function formatDayLabel(iso: string) {
    return new Date(iso).toLocaleDateString('de-AT', {
        timeZone: 'Europe/Vienna',
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
    })
}

const chart = computed(() => {
    const rows = props.rows
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
    if (minY === maxY) { minY -= 1; maxY += 1 }
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
    const yAt = (v: number) => pt + innerH - ((v - minY) / (maxY - minY)) * innerH

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
    const yMinusThree = -3 >= minY && -3 <= maxY ? yAt(-3) : null

    type Pt = { x: number; y: number; v: number }

    const ptsWithZeroCrossings = (key: 'observation' | 'forecast'): Pt[] => {
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

    const pathsBetweenCurveAndZero = (pts: Pt[], positive: boolean): string => {
        if (yZero == null) return ''
        const parts: string[] = []
        let run: Pt[] = []
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

    const fillPositiveRedPath =
        yZero != null
            ? [
                  pathsBetweenCurveAndZero(ptsWithZeroCrossings('observation'), true),
                  pathsBetweenCurveAndZero(ptsWithZeroCrossings('forecast'), true),
              ].filter((s) => s.length > 0).join(' ')
            : ''
    const fillFcBelowPath =
        yZero != null ? pathsBetweenCurveAndZero(ptsWithZeroCrossings('forecast'), false) : ''

    const yTicks = 5
    const tickVals: number[] = []
    for (let t = 0; t <= yTicks; t++) tickVals.push(minY + (t / yTicks) * (maxY - minY))

    const midnightX: number[] = []
    const midnightIndices: number[] = []
    rows.forEach((r, i) => {
        if (/T00:00(:00)?$/.test(r.time)) {
            midnightX.push(xAt(i))
            midnightIndices.push(i)
        }
    })

    const xEnd = pl + innerW
    const midnightLabels: { x: number; time: string }[] = midnightIndices.map((idx, k) => {
        const xStart = xAt(idx)
        const xNext = k + 1 < midnightIndices.length ? xAt(midnightIndices[k + 1]) : xEnd
        return { x: (xStart + xNext) / 2, time: rows[idx].time }
    })
    if (midnightIndices.length > 0 && midnightIndices[0] > 0) {
        const xMid = (pl + xAt(midnightIndices[0])) / 2
        midnightLabels.unshift({ x: xMid, time: rows[0].time })
    }

    return {
        w, h, pl, pr, pt, pb, innerW, innerH,
        midnightX, midnightLabels,
        obsPath: toPath(obsPts),
        pastFcPath: toPath(pastFcPts),
        fcPath: toPath(fcPts),
        yZero, yMinusThree,
        fillPositiveRedPath, fillFcBelowPath,
        tickVals, yAt, rows,
    }
})

const fs = computed(() => props.fontSize ?? 11)
</script>

<template>
    <div v-if="chart">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom: 1em;">
        <svg
            style="height:auto;width:100%;min-width:540px"
            :viewBox="`0 0 ${chart.w} ${chart.h}`"
            role="img"
            aria-label="Diagramm Druckdifferenz Bozen minus Innsbruck: Beobachtung und Vorhersage"
        >
            <!-- Plot background -->
            <rect
                :x="chart.pl" :y="chart.pt"
                :width="chart.innerW" :height="chart.innerH"
                fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"
            />

            <!-- Area fills: warm-red above 0, teal below 0 -->
            <path
                v-if="chart.fillPositiveRedPath"
                :d="chart.fillPositiveRedPath"
                fill="rgb(230 105 88 / 0.35)"
                pointer-events="none"
            />
            <path
                v-if="chart.fillFcBelowPath"
                :d="chart.fillFcBelowPath"
                fill="rgb(78 134 149 / 0.35)"
                pointer-events="none"
            />

            <!-- Y grid -->
            <line
                v-for="(tv, gi) in chart.tickVals"
                :key="'h' + gi"
                :x1="chart.pl" :x2="chart.pl + chart.innerW"
                :y1="chart.yAt(tv)" :y2="chart.yAt(tv)"
                stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1"
            />

            <!-- Midnight verticals -->
            <line
                v-for="(mx, mi) in chart.midnightX"
                :key="'mid' + mi"
                :x1="mx" :x2="mx"
                :y1="chart.pt" :y2="chart.pt + chart.innerH"
                stroke="#94a3b8" stroke-opacity="0.55" stroke-width="0.45"
            />

            <!-- Zero line -->
            <line
                v-if="chart.yZero != null"
                :x1="chart.pl" :x2="chart.pl + chart.innerW"
                :y1="chart.yZero" :y2="chart.yZero"
                stroke="#059669" stroke-width="2"
            />

            <!-- −3 hPa reference line -->
            <line
                v-if="chart.yMinusThree != null"
                :x1="chart.pl" :x2="chart.pl + chart.innerW"
                :y1="chart.yMinusThree" :y2="chart.yMinusThree"
                stroke="#e66958" stroke-width="1.5" stroke-dasharray="6 4"
            />

            <!-- Y axis labels -->
            <text
                v-for="(tv, gi) in chart.tickVals"
                :key="'yl' + gi"
                :x="chart.pl - 8" :y="chart.yAt(tv)"
                :font-size="fs"
                font-family="system-ui, sans-serif"
                fill="#64748b"
                text-anchor="end"
                dominant-baseline="middle"
            >{{ tv.toFixed(1) }}</text>

            <!-- X axis labels: day name + date at each midnight -->
            <text
                v-for="ml in chart.midnightLabels"
                :key="'mid-lbl-' + ml.time"
                :x="ml.x" :y="chart.h - 18"
                :font-size="fs"
                font-family="system-ui, sans-serif"
                fill="#475569"
                text-anchor="middle"
            >{{ formatDayLabel(ml.time) }}</text>

            <!-- Y unit label -->
            <text
                :x="chart.pl" :y="14"
                :font-size="fs"
                font-family="system-ui, sans-serif"
                fill="#64748b"
            >Δp (hPa)</text>

            <!-- Forecast line (#e66958) -->
            <path
                v-if="chart.fcPath"
                :d="chart.fcPath"
                fill="none" stroke="#e66958"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            />

            <!-- Observation line (#4e8695) -->
            <path
                v-if="chart.obsPath"
                :d="chart.obsPath"
                fill="none" stroke="#4e8695"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            />
        </svg>
        </div>

        <!-- Legend -->
        <div style="display:flex;flex-wrap:wrap;gap:0.25em 1.5em;margin-top:0.75em;font-size:0.75em;color:#475569">
            <span style="display:inline-flex;align-items:center;gap:0.5em">
                <span style="display:inline-block;width:1.5em;height:2px;background:#4e8695" />
                Beobachtung
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5em">
                <span style="display:inline-block;width:1.5em;height:2px;background:#e66958" />
                Vorhersage
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5em">
                <span style="display:inline-block;width:1.5em;height:2px;background:#059669" />
                Δp = 0
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5em">
                <span style="display:inline-block;width:1.5em;height:2px;border-top:1.5px dashed #e66958" />
                Δp = −3 hPa
            </span>
        </div>
    </div>
</template>
