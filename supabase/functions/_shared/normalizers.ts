type NumericValue = number | string | null | undefined

export const ETORO_NORMALIZER_VERSION = 'smart-portfolio-nav-boundary-v5'

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
  investedAmount?: NumericValue
  investedAmountInDollars?: NumericValue
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
  notional_exposure?: number
  leverage_multiple?: number | null
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
  notional_exposure: number
  pnl: number
}

interface BrokerTotalResolution {
  value: number | null
  valueUsd: number | null
  sourceField: string | null
}

interface PositionActualValueResolution {
  value: number
  source: string | null
  safelyKnown: boolean
}

interface PositionNotionalExposureResolution {
  value: number
  source: string | null
}

interface SmartPortfolioLookthroughPosition {
  mirrorId: number | null
  mirrorSymbol: string
  symbol: string
  name: string | null
  actualValueUsd: number | null
  actualValueSource: string | null
  notionalExposureUsd: number | null
  notionalExposureSource: string | null
  affectsNav: false
  synthetic: true
}

interface MirrorInspection {
  mirror: RawMirror
  mirrorId: number
  symbol: string
  explicitValue: { value: number; field: string | null } | null
  investedValue: { value: number; source: string } | null
  nestedActualValue: number
  nestedNotionalExposure: number
  nestedPositionCount: number
  lookthrough: SmartPortfolioLookthroughPosition[]
}

interface MirrorValueResolution {
  mirror: RawMirror
  mirrorId: number
  symbol: string
  value: number
  source: string
  residualValue: number | null
  nestedActualValue: number
  nestedNotionalExposure: number
  nestedPositionCount: number
  lookthrough: SmartPortfolioLookthroughPosition[]
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

function getPositionPnlUsd(position: RawPosition): number {
  return round(toNumber(position.unrealizedPnL?.pnL ?? position.pnL))
}

function resolvePositionActualValueUsd(position: RawPosition): PositionActualValueResolution {
  const pnl = getPositionPnlUsd(position)
  const candidates = [
    { value: position.amount, source: 'amount_plus_pnl' },
    { value: position.unitsBaseValueDollars, source: 'unitsBaseValueDollars_plus_pnl' },
    { value: position.initialAmountInDollars, source: 'initialAmountInDollars_plus_pnl' },
    {
      value: position.unrealizedPnL?.marginInAccountCurrency,
      source: 'marginInAccountCurrency_plus_pnl',
    },
  ]

  for (const candidate of candidates) {
    const value = toNumber(candidate.value, Number.NaN)

    if (Number.isFinite(value) && value >= 0) {
      return {
        value: round(value + pnl),
        source: candidate.source,
        safelyKnown: true,
      }
    }
  }

  if (resolvePositionNotionalExposureUsd(position).value > 0) {
    return {
      value: 0,
      source: null,
      safelyKnown: false,
    }
  }

  const units = toNumber(position.units)
  const closeRate = toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate)
  const closeConversionRate = toNumber(
    position.unrealizedPnL?.closeConversionRate ?? position.closeConversionRate,
    1
  )

  if (units > 0 && closeRate > 0 && closeConversionRate > 0) {
    return {
      value: round(units * closeRate * closeConversionRate),
      source: 'units_closeRate_closeConversionRate',
      safelyKnown: true,
    }
  }

  return {
    value: pnl !== 0 ? pnl : 0,
    source: pnl !== 0 ? 'pnl_only' : null,
    safelyKnown: false,
  }
}

function getPositionActualValueUsd(position: RawPosition): number {
  return resolvePositionActualValueUsd(position).value
}

function resolvePositionNotionalExposureUsd(
  position: RawPosition
): PositionNotionalExposureResolution {
  const exposureInAccountCurrency = toNumber(
    position.unrealizedPnL?.exposureInAccountCurrency,
    Number.NaN
  )

  if (Number.isFinite(exposureInAccountCurrency) && exposureInAccountCurrency > 0) {
    return {
      value: round(exposureInAccountCurrency),
      source: 'unrealizedPnL.exposureInAccountCurrency',
    }
  }

  return {
    value: 0,
    source: null,
  }
}

function getPositionNotionalExposureUsd(position: RawPosition): number {
  return resolvePositionNotionalExposureUsd(position).value
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

function getMirrorId(mirror: RawMirror) {
  return toNumber(mirror.mirrorId ?? mirror.mirrorID)
}

function getPositionMirrorId(position: RawPosition): number | null {
  const mirrorId = toNumber(position.mirrorId ?? position.mirrorID, Number.NaN)
  return Number.isFinite(mirrorId) && mirrorId > 0 ? mirrorId : null
}

function getMirrorSymbol(mirror: RawMirror) {
  const mirrorId = getMirrorId(mirror)
  return mirror.parentUsername ?? `MIRROR-${mirrorId}`
}

function isDirectAccountingPosition(position: RawPosition) {
  return getPositionMirrorId(position) === null
}

function groupMirrorLinkedPositions(positions: RawPosition[]) {
  const grouped = new Map<number, RawPosition[]>()

  for (const position of positions) {
    const mirrorId = getPositionMirrorId(position)

    if (mirrorId === null) {
      continue
    }

    grouped.set(mirrorId, [...(grouped.get(mirrorId) ?? []), position])
  }

  return grouped
}

function resolvePositionDisplay(
  position: RawPosition,
  instrumentMetadataMap: Map<number, InstrumentMetadata>
) {
  const instrumentId = position.instrumentId ?? position.instrumentID ?? 0
  const metadata = instrumentMetadataMap.get(instrumentId)

  return {
    symbol: position.symbol ?? metadata?.internalSymbolFull ?? `ID-${instrumentId}`,
    name:
      position.instrumentName ??
      metadata?.internalInstrumentDisplayName ??
      (instrumentId ? `Instrument ${instrumentId}` : null),
  }
}

function buildSmartPortfolioLookthroughPosition(
  args: {
    mirror: RawMirror
    position: RawPosition
    instrumentMetadataMap: Map<number, InstrumentMetadata>
  }
): SmartPortfolioLookthroughPosition {
  const actualValue = resolvePositionActualValueUsd(args.position)
  const notionalExposure = resolvePositionNotionalExposureUsd(args.position)
  const display = resolvePositionDisplay(args.position, args.instrumentMetadataMap)

  return {
    mirrorId: getMirrorId(args.mirror) || null,
    mirrorSymbol: getMirrorSymbol(args.mirror),
    symbol: display.symbol,
    name: display.name,
    actualValueUsd: actualValue.safelyKnown ? actualValue.value : null,
    actualValueSource: actualValue.safelyKnown ? actualValue.source : null,
    notionalExposureUsd: notionalExposure.value > 0 ? notionalExposure.value : null,
    notionalExposureSource: notionalExposure.source,
    affectsNav: false,
    synthetic: true,
  }
}

function resolveMirrorInvestedValue(mirror: RawMirror) {
  const unrealizedPnl = resolveMirrorUnrealizedPnl(mirror)
  const closedPositionsNetProfit = toNumber(mirror.closedPositionsNetProfit)
  const candidates = [
    { value: mirror.investedAmount, field: 'investedAmount' },
    { value: mirror.investedAmountInDollars, field: 'investedAmountInDollars' },
    { value: mirror.initialInvestment, field: 'initialInvestment' },
  ]

  for (const candidate of candidates) {
    const value = toNumber(candidate.value, Number.NaN)

    if (Number.isFinite(value) && value > 0) {
      return {
        value: round(value + unrealizedPnl + closedPositionsNetProfit),
        source: `${candidate.field}_plus_pnl`,
      }
    }
  }

  return null
}

function inspectMirror(
  mirror: RawMirror,
  instrumentMetadataMap: Map<number, InstrumentMetadata>,
  mirrorLinkedPositions: Map<number, RawPosition[]>
): MirrorInspection {
  const mirrorId = getMirrorId(mirror)
  const nestedPositions = [
    ...(Array.isArray(mirror.positions) ? mirror.positions : []),
    ...(mirrorLinkedPositions.get(mirrorId) ?? []),
  ]
  const nestedActualValue = round(
    nestedPositions.reduce((total, position) => total + getPositionActualValueUsd(position), 0)
  )
  const nestedNotionalExposure = round(
    nestedPositions.reduce((total, position) => total + getPositionNotionalExposureUsd(position), 0)
  )

  const explicitValue = pickFirstNonNegativeNumber(mirror, [
    'currentValue',
    'equity',
    'netValue',
    'value',
    'marketValue',
    'portfolioValue',
  ])

  return {
    mirror,
    mirrorId,
    symbol: getMirrorSymbol(mirror),
    explicitValue: explicitValue.value !== null ? explicitValue : null,
    investedValue: resolveMirrorInvestedValue(mirror),
    nestedActualValue,
    nestedNotionalExposure,
    nestedPositionCount: nestedPositions.length,
    // Smart Portfolio look-through is transparency/risk data only. These
    // synthetic rows must never become NAV-affecting holding_snapshots.
    lookthrough: nestedPositions.map((position) =>
      buildSmartPortfolioLookthroughPosition({
        mirror,
        position,
        instrumentMetadataMap,
      })
    ),
  }
}

function resolveMirrorValues(args: {
  mirrors: RawMirror[]
  brokerReportedTotalUsd: number | null
  creditUsd: number
  directActualValueUsd: number
  instrumentMetadataMap: Map<number, InstrumentMetadata>
  mirrorLinkedPositions: Map<number, RawPosition[]>
}): MirrorValueResolution[] {
  const inspections = args.mirrors.map((mirror) =>
    inspectMirror(mirror, args.instrumentMetadataMap, args.mirrorLinkedPositions)
  )
  const resolved = new Map<MirrorInspection, MirrorValueResolution>()

  for (const inspection of inspections) {
    if (inspection.explicitValue) {
      resolved.set(inspection, {
        mirror: inspection.mirror,
        mirrorId: inspection.mirrorId,
        symbol: inspection.symbol,
        value: inspection.explicitValue.value,
        source: `explicit_${inspection.explicitValue.field}`,
        residualValue: null,
        nestedActualValue: inspection.nestedActualValue,
        nestedNotionalExposure: inspection.nestedNotionalExposure,
        nestedPositionCount: inspection.nestedPositionCount,
        lookthrough: inspection.lookthrough,
      })
      continue
    }

    if (inspection.investedValue) {
      resolved.set(inspection, {
        mirror: inspection.mirror,
        mirrorId: inspection.mirrorId,
        symbol: inspection.symbol,
        value: inspection.investedValue.value,
        source: inspection.investedValue.source,
        residualValue: null,
        nestedActualValue: inspection.nestedActualValue,
        nestedNotionalExposure: inspection.nestedNotionalExposure,
        nestedPositionCount: inspection.nestedPositionCount,
        lookthrough: inspection.lookthrough,
      })
    }
  }

  const unresolvedInspections = inspections.filter((inspection) => !resolved.has(inspection))
  const resolvedMirrorActualValue = [...resolved.values()].reduce(
    (total, mirrorValue) => total + mirrorValue.value,
    0
  )
  const residualCandidate =
    args.brokerReportedTotalUsd !== null
      ? round(
          args.brokerReportedTotalUsd -
            args.creditUsd -
            args.directActualValueUsd -
            resolvedMirrorActualValue
        )
      : null

  if (
    unresolvedInspections.length === 1 &&
    residualCandidate !== null &&
    residualCandidate >= 0
  ) {
    const inspection = unresolvedInspections[0]
    if (inspection) {
      resolved.set(inspection, {
        mirror: inspection.mirror,
        mirrorId: inspection.mirrorId,
        symbol: inspection.symbol,
        value: residualCandidate,
        source: 'broker_total_residual',
        residualValue: residualCandidate,
        nestedActualValue: inspection.nestedActualValue,
        nestedNotionalExposure: inspection.nestedNotionalExposure,
        nestedPositionCount: inspection.nestedPositionCount,
        lookthrough: inspection.lookthrough,
      })
    }
  }

  return inspections.map((inspection) => {
    const existing = resolved.get(inspection)

    if (existing) {
      return existing
    }

    if (inspection.nestedActualValue > 0) {
      return {
        mirror: inspection.mirror,
        mirrorId: inspection.mirrorId,
        symbol: inspection.symbol,
        value: inspection.nestedActualValue,
        source: 'nested_actual_values',
        residualValue: null,
        nestedActualValue: inspection.nestedActualValue,
        nestedNotionalExposure: inspection.nestedNotionalExposure,
        nestedPositionCount: inspection.nestedPositionCount,
        lookthrough: inspection.lookthrough,
      }
    }

    return {
      mirror: inspection.mirror,
      mirrorId: inspection.mirrorId,
      symbol: inspection.symbol,
      value: 0,
      source: 'unresolved',
      residualValue: null,
      nestedActualValue: inspection.nestedActualValue,
      nestedNotionalExposure: inspection.nestedNotionalExposure,
      nestedPositionCount: inspection.nestedPositionCount,
      lookthrough: inspection.lookthrough,
    }
  })
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
    const display = resolvePositionDisplay(position, instrumentMetadataMap)
    const quantity = toNumber(position.units)
    const averageOpen = toNumber(position.openRate)
    const currentPrice = toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate)
    const rawPnl = getPositionPnlUsd(position)
    const pnl = convertBrokerAmount(rawPnl, fxContext)
    const rawMarketValue = resolvePositionActualValueUsd(position).value
    const rawNotionalExposure = getPositionNotionalExposureUsd(position)
    const marketValue = convertBrokerAmount(rawMarketValue, fxContext)
    const notionalExposure = convertBrokerAmount(rawNotionalExposure, fxContext)
    const leverageMultiple =
      rawNotionalExposure > 0 && rawMarketValue > 0
        ? round(rawNotionalExposure / rawMarketValue)
        : null

    return {
      symbol: display.symbol,
      instrument_name: display.name,
      quantity: quantity || null,
      average_open: averageOpen || null,
      current_price: currentPrice || null,
      market_value: marketValue,
      notional_exposure: notionalExposure > 0 ? notionalExposure : undefined,
      leverage_multiple: leverageMultiple,
      pnl,
      allocation_pct: 0,
    }
  })
}

function normalizeMirrors(
  mirrorValueResolutions: MirrorValueResolution[],
  fxContext: FxContext
): NormalizedHolding[] {
  return mirrorValueResolutions.map((mirrorValue) => {
    const mirror = mirrorValue.mirror
    const rawPnl = round(
      resolveMirrorUnrealizedPnl(mirror) + toNumber(mirror.closedPositionsNetProfit)
    )
    const rawMarketValue = round(mirrorValue.value)
    const rawNotionalExposure = mirrorValue.nestedNotionalExposure
    const marketValue = convertBrokerAmount(rawMarketValue, fxContext)
    const notionalExposure = convertBrokerAmount(rawNotionalExposure, fxContext)
    const leverageMultiple =
      rawNotionalExposure > 0 && rawMarketValue > 0
        ? round(rawNotionalExposure / rawMarketValue)
        : null

    return {
      symbol: mirrorValue.symbol,
      instrument_name: mirror.parentUsername
        ? `Smart Portfolio: ${mirror.parentUsername}`
        : `Mirror ${mirrorValue.mirrorId}`,
      quantity: null,
      average_open: toNumber(mirror.initialInvestment) || null,
      current_price: null,
      market_value: marketValue,
      notional_exposure: notionalExposure > 0 ? notionalExposure : undefined,
      leverage_multiple: leverageMultiple,
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
        notional_exposure: holding.notional_exposure ?? 0,
        pnl: holding.pnl,
      })
      continue
    }

    existing.instrument_name = existing.instrument_name ?? holding.instrument_name
    existing.market_value = round(existing.market_value + holding.market_value)
    existing.notional_exposure = round(
      existing.notional_exposure + (holding.notional_exposure ?? 0)
    )
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

  return [...grouped.values()].map((holding) => {
    const marketValue = round(holding.market_value)
    const notionalExposure = round(holding.notional_exposure)

    return {
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
      market_value: marketValue,
      notional_exposure: notionalExposure > 0 ? notionalExposure : undefined,
      leverage_multiple:
        notionalExposure > 0 && marketValue > 0 ? round(notionalExposure / marketValue) : null,
      pnl: round(holding.pnl),
      allocation_pct: 0,
    }
  })
}

export function normalizeEtoroData(args: {
  identity?: Record<string, unknown> | null
  pnl: { clientPortfolio?: RawClientPortfolio } | null
  instrumentMetadata?: InstrumentMetadata[]
  fxContext: FxContext
}): NormalizedPortfolioData {
  const pnlClient = args.pnl?.clientPortfolio ?? {}
  const instrumentMetadataMap = buildInstrumentMetadataMap(args.instrumentMetadata ?? [])
  const topLevelPositions = pnlClient.positions ?? []
  const directAccountingPositions = topLevelPositions.filter(isDirectAccountingPosition)
  const mirrorLinkedPositions = groupMirrorLinkedPositions(topLevelPositions)
  const brokerReportedTotal = resolveBrokerReportedTotalAccountValue(pnlClient, args.fxContext)

  const availableCash = convertBrokerAmount(
    toNumber(pnlClient.credit) +
      toNumber(pnlClient.bonusCredit),
    args.fxContext
  )
  const creditUsd = round(toNumber(pnlClient.credit) + toNumber(pnlClient.bonusCredit))
  const directActualValueUsd = round(
    directAccountingPositions.reduce(
      (total, position) => total + getPositionActualValueUsd(position),
      0
    )
  )
  const directNotionalExposureUsd = round(
    directAccountingPositions.reduce(
      (total, position) => total + getPositionNotionalExposureUsd(position),
      0
    )
  )
  const directPositionsUsd = directActualValueUsd
  const mirrorValueResolutions = resolveMirrorValues({
    mirrors: pnlClient.mirrors ?? [],
    brokerReportedTotalUsd: brokerReportedTotal.valueUsd,
    creditUsd,
    directActualValueUsd,
    instrumentMetadataMap,
    mirrorLinkedPositions,
  })
  const mirrorActualValueUsd = round(
    mirrorValueResolutions.reduce((total, mirrorValue) => total + mirrorValue.value, 0)
  )
  const mirrorNotionalExposureUsd = round(
    mirrorValueResolutions.reduce(
      (total, mirrorValue) => total + mirrorValue.nestedNotionalExposure,
      0
    )
  )
  const mirrorValuesUsd = mirrorActualValueUsd
  const mirrorNestedActualValueUsd = round(
    mirrorValueResolutions.reduce((total, mirrorValue) => total + mirrorValue.nestedActualValue, 0)
  )
  const smartPortfolioActualValueUsd = mirrorActualValueUsd
  const smartPortfolioResidualValueUsd = round(
    mirrorValueResolutions.reduce(
      (total, mirrorValue) => total + (mirrorValue.residualValue ?? 0),
      0
    )
  )
  const smartPortfolioNestedActualValueUsd = mirrorNestedActualValueUsd
  const smartPortfolioNestedNotionalExposureUsd = mirrorNotionalExposureUsd
  const smartPortfolioLookthrough = mirrorValueResolutions.flatMap(
    (mirrorValue) => mirrorValue.lookthrough
  )
  const smartPortfolioValueSources = [
    ...new Set(mirrorValueResolutions.map((mirrorValue) => mirrorValue.source)),
  ]
  const smartPortfolioValueSource =
    smartPortfolioValueSources.length === 0
      ? null
      : smartPortfolioValueSources.length === 1
        ? smartPortfolioValueSources[0]
        : 'mixed'
  const nestedMirrorPositionCount = mirrorValueResolutions.reduce(
    (total, mirrorValue) => total + mirrorValue.nestedPositionCount,
    0
  )
  const directHoldings = normalizePositions(
    directAccountingPositions,
    args.fxContext,
    instrumentMetadataMap
  )
  const mirrorHoldings = normalizeMirrors(mirrorValueResolutions, args.fxContext)
  const holdings = aggregateHoldings([...directHoldings, ...mirrorHoldings])
  const holdingsValue = round(holdings.reduce((total, holding) => total + holding.market_value, 0))
  const reconstructedTotalUsd = round(creditUsd + directPositionsUsd + mirrorValuesUsd)
  const reconstructedTotalAccountValue = convertBrokerAmount(reconstructedTotalUsd, args.fxContext)
  const totalAccountValue = round(
    brokerReportedTotal.value ?? reconstructedTotalAccountValue
  )
  const hasUnsafeMirrorFallback = mirrorValueResolutions.some(
    (mirrorValue) => mirrorValue.source === 'unresolved'
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
    directAccountingPositions.reduce(
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
      positionCount: topLevelPositions.length,
      valuation: {
        debugVersion: ETORO_NORMALIZER_VERSION,
        brokerReportedTotalAccountValue: brokerReportedTotal.value,
        brokerReportedTotalAccountValueUsd: brokerReportedTotal.valueUsd,
        brokerReportedTotalAccountValueSourceField: brokerReportedTotal.sourceField,
        creditUsd,
        directActualValueUsd,
        directNotionalExposureUsd,
        directPositionsUsd,
        mirrorActualValueUsd,
        mirrorNotionalExposureUsd,
        mirrorValuesUsd,
        mirrorNestedActualValueUsd,
        smartPortfolioActualValueUsd,
        smartPortfolioValueSource,
        smartPortfolioValueSources,
        smartPortfolioResidualValueUsd,
        smartPortfolioNestedActualValueUsd,
        smartPortfolioNestedNotionalExposureUsd,
        smartPortfolioLookthrough,
        reconstructedTotalUsd,
        reconstructedTotalGbp: reconstructedTotalAccountValue,
        finalTotalAccountValue: totalAccountValue,
        finalValuationSource: valuationSource,
        reconstructedHoldingsValue: holdingsValue,
        reconstructedTotalAccountValue,
        valuationSource,
        mirrorCount: pnlClient.mirrors?.length ?? 0,
        positionCount: topLevelPositions.length,
        directPositionCount: directAccountingPositions.length,
        mirrorLinkedTopLevelPositionCount:
          topLevelPositions.length - directAccountingPositions.length,
        nestedMirrorPositionCount,
      },
      normalizedAt: new Date().toISOString(),
    },
  }
}
