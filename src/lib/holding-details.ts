import { round } from '@shared/calculations'
import type { HoldingDetailView, HoldingPositionDetail, HoldingRow } from '@/types/app'
import type { Tables } from '@/types/database'

type CurrencyCode = 'GBP' | 'USD'

interface SnapshotRawPosition {
  positionID?: number
  instrumentID?: number
  instrumentId?: number
  symbol?: string
  isBuy?: boolean
  units?: number | string | null
  lotCount?: number | string | null
  openRate?: number | string | null
  closeRate?: number | string | null
  stopLossRate?: number | string | null
  takeProfitRate?: number | string | null
  leverage?: number | string | null
  amount?: number | string | null
  initialAmountInDollars?: number | string | null
  unitsBaseValueDollars?: number | string | null
  isSettled?: boolean
  openDateTime?: string
  unrealizedPnL?: {
    pnL?: number | string | null
    closeRate?: number | string | null
  }
}

interface SnapshotInstrumentMetadata {
  internalInstrumentId?: number
  internalSymbolFull?: string
  internalInstrumentDisplayName?: string
  logo35x35?: string
  logo50x50?: string
  logo150x150?: string
}

function toNumber(value: unknown, fallback = 0) {
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

function extractInstrumentMetadata(snapshot: Tables<'portfolio_snapshots'> | null) {
  const items =
    snapshot?.raw_json &&
    typeof snapshot.raw_json === 'object' &&
    !Array.isArray(snapshot.raw_json) &&
    'instrumentMetadata' in snapshot.raw_json &&
    Array.isArray(snapshot.raw_json.instrumentMetadata)
      ? snapshot.raw_json.instrumentMetadata
      : []

  return items
    .filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => item as unknown as SnapshotInstrumentMetadata)
}

function extractPositions(snapshot: Tables<'portfolio_snapshots'> | null) {
  const positions =
    snapshot?.raw_json &&
    typeof snapshot.raw_json === 'object' &&
    !Array.isArray(snapshot.raw_json) &&
    'pnl' in snapshot.raw_json &&
    snapshot.raw_json.pnl &&
    typeof snapshot.raw_json.pnl === 'object' &&
    !Array.isArray(snapshot.raw_json.pnl) &&
    'clientPortfolio' in snapshot.raw_json.pnl &&
    snapshot.raw_json.pnl.clientPortfolio &&
    typeof snapshot.raw_json.pnl.clientPortfolio === 'object' &&
    !Array.isArray(snapshot.raw_json.pnl.clientPortfolio) &&
    'positions' in snapshot.raw_json.pnl.clientPortfolio &&
    Array.isArray(snapshot.raw_json.pnl.clientPortfolio.positions)
      ? snapshot.raw_json.pnl.clientPortfolio.positions
      : []

  return positions
    .filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => item as unknown as SnapshotRawPosition)
}

function extractBrokerToFundRate(snapshot: Tables<'portfolio_snapshots'> | null) {
  const rate =
    snapshot?.raw_json &&
    typeof snapshot.raw_json === 'object' &&
    !Array.isArray(snapshot.raw_json) &&
    'currencies' in snapshot.raw_json &&
    snapshot.raw_json.currencies &&
    typeof snapshot.raw_json.currencies === 'object' &&
    !Array.isArray(snapshot.raw_json.currencies) &&
    'brokerToFundRate' in snapshot.raw_json.currencies
      ? snapshot.raw_json.currencies.brokerToFundRate
      : null

  return toNumber(rate, 1)
}

function resolvePositionSymbol(
  position: SnapshotRawPosition,
  metadataMap: Map<number, SnapshotInstrumentMetadata>
) {
  const instrumentId = toNumber(position.instrumentID ?? position.instrumentId, NaN)
  const metadata = Number.isFinite(instrumentId) ? metadataMap.get(instrumentId) : null

  return (
    position.symbol ??
    metadata?.internalSymbolFull ??
    (Number.isFinite(instrumentId) ? `ID-${instrumentId}` : 'UNKNOWN')
  )
}

function buildPositionMarketValueBroker(position: SnapshotRawPosition) {
  const rawPnl = toNumber(position.unrealizedPnL?.pnL)
  const amount = toNumber(position.amount)
  const unitsBaseValue = toNumber(position.unitsBaseValueDollars)
  const initialAmount = toNumber(position.initialAmountInDollars)
  const quantity = toNumber(position.units ?? position.lotCount)
  const currentPrice = toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate)

  if (amount !== 0) {
    return round(amount + rawPnl, 6)
  }

  if (unitsBaseValue > 0) {
    return round(unitsBaseValue + rawPnl, 6)
  }

  if (initialAmount > 0) {
    return round(initialAmount + rawPnl, 6)
  }

  if (quantity > 0 && currentPrice > 0) {
    return round(quantity * currentPrice, 6)
  }

  return round(rawPnl, 6)
}

export function buildHoldingDetailView(args: {
  symbol: string
  holding: HoldingRow
  latestSnapshot: Tables<'portfolio_snapshots'> | null
  brokerCurrency: CurrencyCode
  fundCurrency: CurrencyCode
}): HoldingDetailView {
  const { symbol, holding, latestSnapshot, brokerCurrency, fundCurrency } = args
  const brokerToFundRate = extractBrokerToFundRate(latestSnapshot)
  const instrumentMetadata = extractInstrumentMetadata(latestSnapshot)
  const metadataMap = new Map(
    instrumentMetadata
      .filter(
        (item) =>
          typeof item.internalInstrumentId === 'number' && Number.isFinite(item.internalInstrumentId)
      )
      .map((item) => [item.internalInstrumentId!, item] as const)
  )

  const positions = extractPositions(latestSnapshot)
    .filter((position) => resolvePositionSymbol(position, metadataMap) === symbol)
    .map<HoldingPositionDetail>((position, index) => {
      const instrumentIdRaw = position.instrumentID ?? position.instrumentId
      const instrumentId = toNumber(instrumentIdRaw, NaN)
      const metadata = Number.isFinite(instrumentId) ? metadataMap.get(instrumentId) : null
      const quantity = round(toNumber(position.units ?? position.lotCount), 6)
      const averageOpen = round(toNumber(position.openRate), 6)
      const currentPrice = round(toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate), 6)
      const pnlBroker = round(toNumber(position.unrealizedPnL?.pnL), 6)
      const investedValueBroker = round(
        toNumber(position.amount) ||
          toNumber(position.initialAmountInDollars) ||
          toNumber(position.unitsBaseValueDollars) ||
          quantity * averageOpen,
        6
      )
      const marketValueBroker = buildPositionMarketValueBroker(position)
      const pnlFund = round(pnlBroker * brokerToFundRate, 6)
      const marketValueFund = round(marketValueBroker * brokerToFundRate, 6)

      return {
        id: String(position.positionID ?? `${symbol}-${index}`),
        symbol,
        instrumentId: Number.isFinite(instrumentId) ? instrumentId : null,
        instrumentName:
          metadata?.internalInstrumentDisplayName ?? holding.instrumentName ?? symbol,
        logoUrl: metadata?.logo50x50 ?? metadata?.logo35x35 ?? metadata?.logo150x150 ?? null,
        openedAt: position.openDateTime ?? null,
        side: position.isBuy === false ? 'SELL' : 'BUY',
        quantity,
        averageOpen,
        currentPrice,
        stopLoss: (() => {
          const value = toNumber(position.stopLossRate, 0)
          return value > 0 ? round(value, 6) : null
        })(),
        takeProfit: (() => {
          const value = toNumber(position.takeProfitRate, 0)
          return value > 0 ? round(value, 6) : null
        })(),
        investedValueBroker,
        marketValueBroker,
        marketValueFund,
        pnlBroker,
        pnlFund,
        pnlPct: investedValueBroker > 0 ? round(pnlBroker / investedValueBroker, 6) : null,
        leverage: (() => {
          const value = toNumber(position.leverage, 0)
          return value > 0 ? value : null
        })(),
        isSettled: typeof position.isSettled === 'boolean' ? position.isSettled : null,
      }
    })
    .sort((left, right) => {
      if (left.openedAt && right.openedAt) {
        return new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime()
      }

      if (left.openedAt) {
        return -1
      }

      if (right.openedAt) {
        return 1
      }

      return right.marketValueFund - left.marketValueFund
    })

  const primaryPosition = positions[0] ?? null

  return {
    symbol,
    instrumentName:
      primaryPosition?.instrumentName ??
      positions[0]?.instrumentName ??
      holding.instrumentName ??
      symbol,
    logoUrl: positions[0]?.logoUrl ?? null,
    quantity: holding.quantity,
    averageOpen: holding.averageOpen,
    currentPrice: holding.currentPrice,
    marketValue: holding.marketValue,
    pnl: holding.pnl,
    allocationPct: holding.allocationPct,
    positions,
    brokerCurrency,
    fundCurrency,
    capturedAt: latestSnapshot?.captured_at ?? null,
  }
}
