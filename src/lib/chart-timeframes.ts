import type { SnapshotChartPoint } from '@/types/app'

export type ChartTimeframe = 'day' | 'week' | 'month'

export interface TimeframedSnapshotPoint extends SnapshotChartPoint {
  capturedAtMs: number
}

export interface TimeframeWindow {
  timeframe: ChartTimeframe
  label: string
  shortLabel: string
  changeLabel: string
  tickUnitLabel: string
  durationMs: number
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const TIMEFRAME_WINDOWS: Record<ChartTimeframe, TimeframeWindow> = {
  day: {
    timeframe: 'day',
    label: 'Day',
    shortLabel: '1D',
    changeLabel: 'today',
    tickUnitLabel: 'hour',
    durationMs: DAY_MS,
  },
  week: {
    timeframe: 'week',
    label: 'Week',
    shortLabel: '1W',
    changeLabel: 'this week',
    tickUnitLabel: 'day',
    durationMs: 7 * DAY_MS,
  },
  month: {
    timeframe: 'month',
    label: 'Month',
    shortLabel: '1M',
    changeLabel: 'this month',
    tickUnitLabel: 'day',
    durationMs: 30 * DAY_MS,
  },
}

export interface TimeframeSeriesResult {
  timeframe: ChartTimeframe
  rangeStartMs: number
  rangeEndMs: number
  points: TimeframedSnapshotPoint[]
}

export interface TimeframeChangeSummary {
  changeAmount: number
  changePct: number
  baselineAt: string
  latestAt: string
}

function getSortedPoints(series: SnapshotChartPoint[]) {
  return [...series]
    .map((point) => ({
      ...point,
      capturedAtMs: new Date(point.capturedAt).getTime(),
    }))
    .filter((point) => Number.isFinite(point.capturedAtMs))
    .sort((left, right) => left.capturedAtMs - right.capturedAtMs)
}

function getAlignedRangeEndMs(referenceMs: number, timeframe: ChartTimeframe) {
  const date = new Date(referenceMs)

  if (timeframe === 'day') {
    date.setMinutes(0, 0, 0)
    if (date.getTime() < referenceMs) {
      date.setHours(date.getHours() + 1)
    }
    return date.getTime()
  }

  date.setHours(0, 0, 0, 0)
  if (date.getTime() < referenceMs) {
    date.setDate(date.getDate() + 1)
  }
  return date.getTime()
}

export function getTimeframedSnapshotSeries(
  series: SnapshotChartPoint[],
  timeframe: ChartTimeframe
): TimeframeSeriesResult {
  const sortedPoints = getSortedPoints(series)
  const durationMs = TIMEFRAME_WINDOWS[timeframe].durationMs
  const latestPoint = sortedPoints.at(-1)
  const rangeEndMs = getAlignedRangeEndMs(latestPoint?.capturedAtMs ?? Date.now(), timeframe)
  const rangeStartMs = rangeEndMs - durationMs
  const points = sortedPoints.filter(
    (point) => point.capturedAtMs >= rangeStartMs && point.capturedAtMs <= rangeEndMs
  )

  return {
    timeframe,
    rangeStartMs,
    rangeEndMs,
    points,
  }
}

export function getTimeframeTicks(
  rangeStartMs: number,
  rangeEndMs: number,
  timeframe: ChartTimeframe
) {
  const tickCount = timeframe === 'day' ? 7 : timeframe === 'week' ? 8 : 7

  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || rangeEndMs <= rangeStartMs) {
    return [rangeStartMs]
  }

  const step = (rangeEndMs - rangeStartMs) / (tickCount - 1)

  return Array.from({ length: tickCount }, (_, index) =>
    Math.round(rangeStartMs + step * index)
  )
}

export function getTimeframeChangeSummary(
  series: SnapshotChartPoint[],
  timeframe: ChartTimeframe
): TimeframeChangeSummary | null {
  const sortedPoints = getSortedPoints(series)

  if (sortedPoints.length === 0) {
    return null
  }

  const latestPoint = sortedPoints.at(-1)
  if (!latestPoint) {
    return null
  }

  const rangeStartMs = latestPoint.capturedAtMs - TIMEFRAME_WINDOWS[timeframe].durationMs
  const baselinePoint =
    sortedPoints.find((point) => point.capturedAtMs >= rangeStartMs) ?? sortedPoints[0]

  // Performance should follow the change in unit price, not raw account value.
  // That keeps deposits and withdrawals from showing up as artificial gains.
  const changeAmount = latestPoint.unitPrice - baselinePoint.unitPrice
  const changePct = baselinePoint.unitPrice > 0 ? changeAmount / baselinePoint.unitPrice : 0

  return {
    changeAmount,
    changePct,
    baselineAt: baselinePoint.capturedAt,
    latestAt: latestPoint.capturedAt,
  }
}

export function formatTimeframeTick(value: number, timeframe: ChartTimeframe) {
  const date = new Date(value)

  if (timeframe === 'day') {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (timeframe === 'week') {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
    })
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}
