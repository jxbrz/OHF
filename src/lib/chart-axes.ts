export interface NumericAxisResult {
  domain: readonly [number, number]
  ticks: number[]
  fractionDigits: number
}

interface NumericAxisOptions {
  tickCount?: number
  paddingRatio?: number
  minimumPadding?: number
}

function getNiceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1
  }

  const exponent = Math.floor(Math.log10(value))
  const fraction = value / 10 ** exponent

  if (fraction <= 1) {
    return 1 * 10 ** exponent
  }

  if (fraction <= 2) {
    return 2 * 10 ** exponent
  }

  if (fraction <= 5) {
    return 5 * 10 ** exponent
  }

  return 10 * 10 ** exponent
}

function getFractionDigits(value: number) {
  const normalized = value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
  const decimalPart = normalized.split('.')[1]
  return decimalPart ? decimalPart.length : 0
}

function normalizeNumber(value: number, fractionDigits: number) {
  const rounded = Number(value.toFixed(Math.min(fractionDigits + 2, 8)))
  return Object.is(rounded, -0) ? 0 : rounded
}

export function getEvenNumericAxis(
  values: number[],
  options?: NumericAxisOptions
): NumericAxisResult {
  const numericValues = values.filter((value) => Number.isFinite(value))

  if (numericValues.length === 0) {
    return {
      domain: [0, 1] as const,
      ticks: [0, 0.25, 0.5, 0.75, 1],
      fractionDigits: 2,
    }
  }

  const tickCount = Math.max(options?.tickCount ?? 5, 2)
  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const range = maxValue - minValue
  const padding = Math.max(
    range === 0 ? Math.abs(maxValue) * 0.08 : range * (options?.paddingRatio ?? 0.14),
    options?.minimumPadding ?? 1
  )
  const paddedMin = minValue - padding
  const paddedMax = maxValue + padding
  const rawStep = (paddedMax - paddedMin) / (tickCount - 1)
  const step = getNiceStep(rawStep)
  const fractionDigits = getFractionDigits(step)
  const domainMin = normalizeNumber(Math.floor(paddedMin / step) * step, fractionDigits)
  const domainMax = normalizeNumber(Math.ceil(paddedMax / step) * step, fractionDigits)
  const ticks: number[] = []

  for (let tickValue = domainMin; tickValue <= domainMax + step / 2; tickValue += step) {
    ticks.push(normalizeNumber(tickValue, fractionDigits))
  }

  return {
    domain: [domainMin, domainMax] as const,
    ticks,
    fractionDigits,
  }
}
