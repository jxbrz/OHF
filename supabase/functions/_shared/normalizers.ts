type NumericValue = number | string | null | undefined

export const ETORO_NORMALIZER_VERSION = 'smart-portfolio-nested-positions-v3'

interface RawPosition {
  positionId?: number
  positionID?: number
  instrumentId?: number
  instrumentID?: number
  mirrorId?: number
  mirrorID?: number
  openRate?: NumericValue
  closeRate?: NumericValue
  amount?: NumericValue
  units?: NumericValue
  initialAmountInDollars?: NumericValue
  unitsBaseValueDollars?: NumericValue
  openConversionRate?: NumericValue
  closeConversionRate?: NumericValue
  pnL?: NumericValue
  symbol?: string
  instrumentName?: string
  unrealizedPnL?: {
    pnL?: NumericValue
    exposureInAccountCurrency?: NumericValue
    exposureInAssetCurrency?: NumericValue
    marginInAccountCurrency?: NumericValue
    closeRate?: NumericValue
    closeConversionRate?: NumericValue
  }
}

interface RawMirror {
  mirrorId?: number
  mirrorID?: number
  parentUsername?: string
  positions?: RawPosition[]
  currentValue?: NumericValue
  value?: NumericValue
  equity?: NumericValue
  netValue?: NumericValue
  marketValue?: NumericValue
  portfolioValue?: NumericValue
  availableAmount?: NumericValue
  initialInvestment?: NumericValue
  unrealizedPnL?: NumericValue | {
    pnL?: NumericValue
  }
  pnL?: NumericValue
  closedPositionsNetProfit?: NumericValue
}

interface RawClientPortfolio {
  credit?: NumericValue
  bonusCredit?: NumericValue
  totalAccountValue?: NumericValue
  accountValue?: NumericValue
  accountEquity?: NumericValue
  clientEquity?: NumericValue
  equity?: NumericValue
  totalEquity?: NumericValue
  portfolioValue?: NumericValue
  totalPortfolioValue?: NumericValue
  currentValue?: NumericValue
  value?: NumericValue
  netValue?: NumericValue
  netAssetValue?: NumericValue
  unrealizedPnL?: NumericValue
  accountCurrencyId?: NumericValue
  positions?: RawPosition[]
  mirrors?: RawMirror[]
}

interface FxContext {
  brokerCurrency: string
  fundCurrency: string
  rate: number
  source: 'same_currency' | 'manual_override' | 'ecb_reference'
  referenceDate: string | null
}

interface InstrumentMetadata {
  internalInstrumentId?: number
  internalSymbolFull?: string
  internalInstrumentDisplayName?: string
  logo35x35?: string
  logo50x50?: string
  logo150x150?: string
}

export interface NormalizedHolding {
  symbol: string
  instrument_name: string | null
  quantity: number | null
  average_open: number | null
  current_price: number | null
  market_value: number
  pnl: number
  allocation_pct: number
}

export interface NormalizedPortfolioData {
  totalAccountValue: number
  availableCash: number
  unrealizedPnl: number
  realizedPnl: number
  holdings: NormalizedHolding[]
  rawJson: Record<string, unknown>
}

interface HoldingAggregationState {
  symbol: string
  instrument_name: string | null
  quantityTotal: number
  quantityCount: number
  averageOpenWeightedTotal: number
  averageOpenCount: number
  currentPriceWeightedTotal: number
  currentPriceCount: number
  market_value: number
  pnl: number
}

interface BrokerTotalResolution {
  value: number | null
  valueUsd: number | null
  sourceField: string | null
}

interface MirrorValueResolution {
  value: number
  source: 'nested_positions' | 'explicit_value' | 'initial_investment_plus_pnl' | 'available_amount'
  nestedExposure: number
  nestedPositionCount: number
}

function toNumber(value: NumericValue, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function convertBrokerAmount(value: number, fxContext: FxContext) {
  return round(value * fxContext.rate)
}

function pickFirstNonNegativeNumber(
  source: object,
  fields: string[]
): { value: number | null; field: string | null } {
  for (const field of fields) {
    const value = toNumber((source as Record<string, unknown>)[field] as NumericValue, Number.NaN)

    if (Number.isFinite(value) && value >= 0) {
      return { value, field }
    }
  }

  return { value: null, field: null }
}

function resolveBrokerReportedTotalAccountValue(
  clientPortfolio: RawClientPortfolio,
  fxContext: FxContext
): BrokerTotalResolution {
  const resolved = pickFirstNonNegativeNumber(clientPortfolio, [
    'totalAccountValue',
    'accountValue',
    'accountEquity',
    'clientEquity',
    'totalEquity',
    'equity',
    'netAssetValue',
    'netValue',
    'totalPortfolioValue',
    'portfolioValue',
  ])

  return {
    value: resolved.value !== null ? convertBrokerAmount(resolved.value, fxContext) : null,
    valueUsd: resolved.value,
    sourceField: resolved.field,
  }
}

function getPositionExposureUsd(position: RawPosition): number {
  const exposureInAccountCurrency = toNumber(
    position.unrealizedPnL?.exposureInAccountCurrency,
    Number.NaN
  )

  if (Number.isFinite(exposureInAccountCurrency) && exposureInAccountCurrency > 0) {
    return round(exposureInAccountCurrency)
  }

  const amount = toNumber(position.amount)
  const pnl = toNumber(position.unrealizedPnL?.pnL ?? position.pnL)

  if (amount !== 0 || pnl !== 0) {
    return round(amount + pnl)
  }

  const units = toNumber(position.units)
  const closeRate = toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate)
  const closeConversionRate = toNumber(
    position.unrealizedPnL?.closeConversionRate ?? position.closeConversionRate,
    1
  )

  if (units > 0 && closeRate > 0 && closeConversionRate > 0) {
    return round(units * closeRate * closeConversionRate)
  }

  return 0
}

function resolveMirrorUnrealizedPnl(mirror: RawMirror) {
  if (
    mirror.unrealizedPnL &&
    typeof mirror.unrealizedPnL === 'object' &&
    !Array.isArray(mirror.unrealizedPnL)
  ) {
    return toNumber(mirror.unrealizedPnL.pnL)
  }

  return toNumber(mirror.unrealizedPnL ?? mirror.pnL)
}

function resolveMirrorValue(mirror: RawMirror): MirrorValueResolution {
  const nestedPositions = Array.isArray(mirror.positions) ? mirror.positions : []
  const nestedExposure = round(
    nestedPositions.reduce((total, position) => total + getPositionExposureUsd(position), 0)
  )

  if (nestedExposure > 0) {
    return {
      value: nestedExposure,
      source: 'nested_positions',
      nestedExposure,
      nestedPositionCount: nestedPositions.length,
    }
  }

  const explicitValue = pickFirstNonNegativeNumber(mirror, [
    'currentValue',
    'value',
    'equity',
    'netValue',
    'marketValue',
    'portfolioValue',
  ])

  if (explicitValue.value !== null) {
    return {
      value: explicitValue.value,
      source: 'explicit_value',
      nestedExposure,
      nestedPositionCount: nestedPositions.length,
    }
  }

  const initialInvestment = toNumber(mirror.initialInvestment)
  const unrealizedPnl = resolveMirrorUnrealizedPnl(mirror)
  const closedPositionsNetProfit = toNumber(mirror.closedPositionsNetProfit)

  if (initialInvestment > 0) {
    return {
      value: initialInvestment + unrealizedPnl + closedPositionsNetProfit,
      source: 'initial_investment_plus_pnl',
      nestedExposure,
      nestedPositionCount: nestedPositions.length,
    }
  }

  return {
    value: toNumber(mirror.availableAmount),
    source: 'available_amount',
    nestedExposure,
    nestedPositionCount: nestedPositions.length,
  }
}

function buildInstrumentMetadataMap(metadata: InstrumentMetadata[]) {
  return new Map(
    metadata
      .filter(
        (item) =>
          typeof item.internalInstrumentId === 'number' &&
          Number.isFinite(item.internalInstrumentId)
      )
      .map((item) => [item.internalInstrumentId!, item] as const)
  )
}

function normalizePositions(
  positions: RawPosition[],
  fxContext: FxContext,
  instrumentMetadataMap: Map<number, InstrumentMetadata>
): NormalizedHolding[] {
  return positions.map((position) => {
    const instrumentId = position.instrumentId ?? position.instrumentID ?? 0
    const metadata = instrumentMetadataMap.get(instrumentId)
    const quantity = toNumber(position.units)
    const averageOpen = toNumber(position.openRate)
    const currentPrice = toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate)
    const rawPnl = round(toNumber(position.unrealizedPnL?.pnL ?? position.pnL))
    const pnl = convertBrokerAmount(rawPnl, fxContext)
    const amount = toNumber(position.amount)
    const unitsBaseValue = toNumber(position.unitsBaseValueDollars)
    const initialAmount = toNumber(position.initialAmountInDollars)
    const exposure = getPositionExposureUsd(position)
    const rawMarketValue = round(
      exposure > 0
        ? exposure
        : amount !== 0
        ? amount + rawPnl
        : unitsBaseValue > 0
          ? unitsBaseValue + rawPnl
          : initialAmount > 0
            ? initialAmount + rawPnl
            : quantity > 0 && currentPrice > 0
              ? quantity * currentPrice
              : rawPnl
    )
    const marketValue = convertBrokerAmount(rawMarketValue, fxContext)

    return {
      symbol: position.symbol ?? metadata?.internalSymbolFull ?? `ID-${instrumentId}`,
      instrument_name:
        position.instrumentName ??
        metadata?.internalInstrumentDisplayName ??
        `Instrument ${instrumentId}`,
      quantity: quantity || null,
      average_open: averageOpen || null,
      current_price: currentPrice || null,
      market_value: marketValue,
      pnl,
      allocation_pct: 0,
    }
  })
}

function normalizeMirrors(mirrors: RawMirror[], fxContext: FxContext): NormalizedHolding[] {
  return mirrors.map((mirror) => {
    const mirrorId = mirror.mirrorId ?? mirror.mirrorID ?? 0
    const mirrorValue = resolveMirrorValue(mirror)
    const rawPnl = round(
      resolveMirrorUnrealizedPnl(mirror) + toNumber(mirror.closedPositionsNetProfit)
    )
    const rawMarketValue = round(mirrorValue.value)
    const marketValue = convertBrokerAmount(rawMarketValue, fxContext)
    const symbol = mirror.parentUsername ?? `MIRROR-${mirrorId}`

    return {
      symbol,
      instrument_name: mirror.parentUsername
        ? `Smart Portfolio: ${mirror.parentUsername}`
        : `Mirror ${mirrorId}`,
      quantity: null,
      average_open: toNumber(mirror.initialInvestment) || null,
      current_price: null,
      market_value: marketValue,
      pnl: convertBrokerAmount(rawPnl, fxContext),
      allocation_pct: 0,
    }
  })
}

function aggregateHoldings(holdings: NormalizedHolding[]): NormalizedHolding[] {
  const grouped = new Map<string, HoldingAggregationState>()

  for (const holding of holdings) {
    const existing = grouped.get(holding.symbol)

    if (!existing) {
      grouped.set(holding.symbol, {
        symbol: holding.symbol,
        instrument_name: holding.instrument_name,
        quantityTotal: holding.quantity ?? 0,
        quantityCount: holding.quantity ?? 0,
        averageOpenWeightedTotal:
          holding.quantity !== null && holding.average_open !== null
            ? holding.quantity * holding.average_open
            : 0,
        averageOpenCount:
          holding.quantity !== null && holding.average_open !== null ? holding.quantity : 0,
        currentPriceWeightedTotal:
          holding.quantity !== null && holding.current_price !== null
            ? holding.quantity * holding.current_price
            : 0,
        currentPriceCount:
          holding.quantity !== null && holding.current_price !== null ? holding.quantity : 0,
        market_value: holding.market_value,
        pnl: holding.pnl,
      })
      continue
    }

    existing.instrument_name = existing.instrument_name ?? holding.instrument_name
    existing.market_value = round(existing.market_value + holding.market_value)
    existing.pnl = round(existing.pnl + holding.pnl)

    if (holding.quantity !== null) {
      existing.quantityTotal = round(existing.quantityTotal + holding.quantity, 8)
      existing.quantityCount = round(existing.quantityCount + holding.quantity, 8)
    }

    if (holding.quantity !== null && holding.average_open !== null) {
      existing.averageOpenWeightedTotal = round(
        existing.averageOpenWeightedTotal + holding.quantity * holding.average_open,
        10
      )
      existing.averageOpenCount = round(existing.averageOpenCount + holding.quantity, 8)
    }

    if (holding.quantity !== null && holding.current_price !== null) {
      existing.currentPriceWeightedTotal = round(
        existing.currentPriceWeightedTotal + holding.quantity * holding.current_price,
        10
      )
      existing.currentPriceCount = round(existing.currentPriceCount + holding.quantity, 8)
    }
  }

  return [...grouped.values()].map((holding) => ({
    symbol: holding.symbol,
    instrument_name: holding.instrument_name,
    quantity: holding.quantityCount > 0 ? round(holding.quantityTotal, 8) : null,
    average_open:
      holding.averageOpenCount > 0
        ? round(holding.averageOpenWeightedTotal / holding.averageOpenCount, 8)
        : null,
    current_price:
      holding.currentPriceCount > 0
        ? round(holding.currentPriceWeightedTotal / holding.currentPriceCount, 8)
        : null,
    market_value: round(holding.market_value),
    pnl: round(holding.pnl),
    allocation_pct: 0,
  }))
}

export function normalizeEtoroData(args: {
  identity?: Record<string, unknown> | null
  pnl: { clientPortfolio?: RawClientPortfolio } | null
  instrumentMetadata?: InstrumentMetadata[]
  fxContext: FxContext
}): NormalizedPortfolioData {
  const pnlClient = args.pnl?.clientPortfolio ?? {}
  const instrumentMetadataMap = buildInstrumentMetadataMap(args.instrumentMetadata ?? [])

  const availableCash = convertBrokerAmount(
    toNumber(pnlClient.credit) +
      toNumber(pnlClient.bonusCredit),
    args.fxContext
  )
  const creditUsd = round(toNumber(pnlClient.credit) + toNumber(pnlClient.bonusCredit))
  const directPositionsUsd = round(
    (pnlClient.positions ?? []).reduce(
      (total, position) => total + getPositionExposureUsd(position),
      0
    )
  )
  const mirrorValueResolutions = (pnlClient.mirrors ?? []).map(resolveMirrorValue)
  const mirrorValuesUsd = round(
    mirrorValueResolutions.reduce((total, mirrorValue) => total + mirrorValue.value, 0)
  )
  const mirrorNestedExposureUsd = round(
    mirrorValueResolutions.reduce((total, mirrorValue) => total + mirrorValue.nestedExposure, 0)
  )
  const nestedMirrorPositionCount = mirrorValueResolutions.reduce(
    (total, mirrorValue) => total + mirrorValue.nestedPositionCount,
    0
  )
  const directHoldings = normalizePositions(
    pnlClient.positions ?? [],
    args.fxContext,
    instrumentMetadataMap
  )
  const mirrorHoldings = normalizeMirrors(pnlClient.mirrors ?? [], args.fxContext)
  const holdings = aggregateHoldings([...directHoldings, ...mirrorHoldings])
  const holdingsValue = round(holdings.reduce((total, holding) => total + holding.market_value, 0))
  const reconstructedTotalUsd = round(creditUsd + directPositionsUsd + mirrorValuesUsd)
  const reconstructedTotalAccountValue = convertBrokerAmount(reconstructedTotalUsd, args.fxContext)
  const brokerReportedTotal = resolveBrokerReportedTotalAccountValue(pnlClient, args.fxContext)
  const totalAccountValue = round(
    brokerReportedTotal.value ?? reconstructedTotalAccountValue
  )
  const hasUnsafeMirrorFallback = mirrorValueResolutions.some(
    (mirrorValue) => mirrorValue.source === 'available_amount'
  )
  const valuationSource =
    brokerReportedTotal.value !== null
      ? 'broker_reported'
      : hasUnsafeMirrorFallback
        ? 'reconstructed_unsafe'
        : 'reconstructed_from_positions_and_mirrors'
  const realizedPnl = convertBrokerAmount(
    (pnlClient.mirrors ?? []).reduce(
      (total, mirror) => total + toNumber(mirror.closedPositionsNetProfit),
      0
    ),
    args.fxContext
  )
  const rawUnrealizedPnl =
    toNumber(pnlClient.unrealizedPnL) ||
    (pnlClient.positions ?? []).reduce(
      (total, position) => total + toNumber(position.unrealizedPnL?.pnL ?? position.pnL),
      0
    )
  const unrealizedPnl = convertBrokerAmount(rawUnrealizedPnl, args.fxContext)

  const normalizedHoldings = holdings.map((holding) => ({
    ...holding,
    allocation_pct: totalAccountValue > 0 ? round(holding.market_value / totalAccountValue, 6) : 0,
  }))

  return {
    totalAccountValue,
    availableCash,
    unrealizedPnl,
    realizedPnl,
    holdings: normalizedHoldings,
    rawJson: {
      debugVersion: ETORO_NORMALIZER_VERSION,
      identity: args.identity ?? null,
      pnl: args.pnl,
      instrumentMetadata: args.instrumentMetadata ?? [],
      currencies: {
        brokerCurrency: args.fxContext.brokerCurrency,
        fundCurrency: args.fxContext.fundCurrency,
        brokerToFundRate: args.fxContext.rate,
        source: args.fxContext.source,
        referenceDate: args.fxContext.referenceDate,
        accountCurrencyId: pnlClient.accountCurrencyId ?? null,
      },
      brokerReportedTotalAccountValue: brokerReportedTotal.value,
      reconstructedHoldingsValue: holdingsValue,
      valuationSource,
      mirrorCount: pnlClient.mirrors?.length ?? 0,
      positionCount: pnlClient.positions?.length ?? 0,
      valuation: {
        debugVersion: ETORO_NORMALIZER_VERSION,
        brokerReportedTotalAccountValue: brokerReportedTotal.value,
        brokerReportedTotalAccountValueUsd: brokerReportedTotal.valueUsd,
        brokerReportedTotalAccountValueSourceField: brokerReportedTotal.sourceField,
        creditUsd,
        directPositionsUsd,
        mirrorValuesUsd,
        mirrorNestedExposureUsd,
        reconstructedTotalUsd,
        reconstructedTotalGbp: reconstructedTotalAccountValue,
        finalTotalAccountValue: totalAccountValue,
        finalValuationSource: valuationSource,
        reconstructedHoldingsValue: holdingsValue,
        reconstructedTotalAccountValue,
        valuationSource,
        mirrorCount: pnlClient.mirrors?.length ?? 0,
        positionCount: pnlClient.positions?.length ?? 0,
        directPositionCount: pnlClient.positions?.length ?? 0,
        nestedMirrorPositionCount,
      },
      normalizedAt: new Date().toISOString(),
    },
  }
}
