const numberFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

function resolveLocale(currency: 'GBP' | 'USD') {
  return currency === 'USD' ? 'en-US' : 'en-GB'
}

export function formatCurrency(value: number, currency: 'GBP' | 'USD' = 'GBP') {
  return new Intl.NumberFormat(resolveLocale(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatCompactCurrency(value: number, currency: 'GBP' | 'USD' = 'GBP') {
  return new Intl.NumberFormat(resolveLocale(currency), {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatCurrencyAxis(
  value: number,
  currency: 'GBP' | 'USD' = 'GBP',
  maximumFractionDigits = 0
) {
  return new Intl.NumberFormat(resolveLocale(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(value || 0)
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits,
  }).format(value || 0)
}

export function formatPercent(value: number) {
  return percentFormatter.format(value || 0)
}

export function formatSignedCurrency(value: number, currency: 'GBP' | 'USD' = 'GBP') {
  const formatted = formatCurrency(Math.abs(value), currency)
  if (value > 0) {
    return `+${formatted}`
  }

  if (value < 0) {
    return `-${formatted}`
  }

  return formatted
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'N/A'
  }

  return dateTimeFormatter.format(new Date(value))
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'N/A'
  }

  return dateFormatter.format(new Date(value))
}

export function toDateTimeLocalValue(value: string) {
  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export { numberFormatter }
