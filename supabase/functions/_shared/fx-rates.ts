interface EcbRateTable {
  referenceDate: string
  rates: Record<string, number>
}

export interface FxConversionResult {
  brokerCurrency: string
  fundCurrency: string
  rate: number
  source: 'same_currency' | 'manual_override' | 'ecb_reference'
  referenceDate: string | null
}

const ECB_DAILY_XML_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

function round(value: number, decimals = 10): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function parseEcbReferenceRates(xml: string): EcbRateTable {
  const referenceDateMatch = xml.match(/<Cube\s+time=['"]([^'"]+)['"]>/i)
  if (!referenceDateMatch) {
    throw new Error('ECB reference date was not found in the FX payload.')
  }

  const rates: Record<string, number> = { EUR: 1 }
  const rateRegex = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]\s*\/?>/g
  let match = rateRegex.exec(xml)

  while (match) {
    const [, currency, rawRate] = match
    const parsedRate = Number(rawRate)

    if (Number.isFinite(parsedRate) && parsedRate > 0) {
      rates[currency] = parsedRate
    }

    match = rateRegex.exec(xml)
  }

  return {
    referenceDate: referenceDateMatch[1],
    rates,
  }
}

export function calculateEcbCrossRate(
  rates: Record<string, number>,
  fromCurrency: string,
  toCurrency: string
): number {
  const normalizedFromCurrency = fromCurrency.toUpperCase()
  const normalizedToCurrency = toCurrency.toUpperCase()

  if (normalizedFromCurrency === normalizedToCurrency) {
    return 1
  }

  const fromRate = rates[normalizedFromCurrency]
  const toRate = rates[normalizedToCurrency]

  if (!isPositiveNumber(fromRate) || !isPositiveNumber(toRate)) {
    throw new Error(
      `ECB reference rates do not include the ${normalizedFromCurrency}/${normalizedToCurrency} currency pair.`
    )
  }

  return round(toRate / fromRate, 10)
}

async function fetchEcbReferenceRates(): Promise<EcbRateTable> {
  const response = await fetch(ECB_DAILY_XML_URL, {
    headers: {
      Accept: 'application/xml,text/xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to load ECB FX rates (${response.status}).`)
  }

  return parseEcbReferenceRates(await response.text())
}

export async function resolveFxConversion(args: {
  brokerCurrency: string
  fundCurrency: string
  manualRate?: number | null
}): Promise<FxConversionResult> {
  const brokerCurrency = args.brokerCurrency.toUpperCase()
  const fundCurrency = args.fundCurrency.toUpperCase()

  if (brokerCurrency === fundCurrency) {
    return {
      brokerCurrency,
      fundCurrency,
      rate: 1,
      source: 'same_currency',
      referenceDate: null,
    }
  }

  if (isPositiveNumber(args.manualRate)) {
    return {
      brokerCurrency,
      fundCurrency,
      rate: round(args.manualRate, 10),
      source: 'manual_override',
      referenceDate: null,
    }
  }

  const ecbRates = await fetchEcbReferenceRates()

  return {
    brokerCurrency,
    fundCurrency,
    rate: calculateEcbCrossRate(ecbRates.rates, brokerCurrency, fundCurrency),
    source: 'ecb_reference',
    referenceDate: ecbRates.referenceDate,
  }
}
