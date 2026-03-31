type NumericValue = number | string | null | undefined

interface RawPosition {
  positionId?: number
  positionID?: number
  instrumentId?: number
  instrumentID?: number
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
    closeRate?: NumericValue
  }
}

interface RawMirror {
  mirrorId?: number
  mirrorID?: number
  parentUsername?: string
  availableAmount?: NumericValue
  initialInvestment?: NumericValue
  closedPositionsNetProfit?: NumericValue
}

interface RawClientPortfolio {
  credit?: NumericValue
  bonusCredit?: NumericValue
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

function normalizePositions(positions: RawPosition[], fxContext: FxContext): NormalizedHolding[] {
  return positions.map((position) => {
    const instrumentId = position.instrumentId ?? position.instrumentID ?? 0
    const quantity = toNumber(position.units)
    const averageOpen = toNumber(position.openRate)
    const currentPrice = toNumber(position.unrealizedPnL?.closeRate ?? position.closeRate)
    const rawPnl = round(toNumber(position.unrealizedPnL?.pnL ?? position.pnL))
    const pnl = convertBrokerAmount(rawPnl, fxContext)
    const amount = toNumber(position.amount)
    const unitsBaseValue = toNumber(position.unitsBaseValueDollars)
    const initialAmount = toNumber(position.initialAmountInDollars)
    const rawMarketValue = round(
      amount !== 0
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
      symbol: position.symbol ?? `ID-${instrumentId}`,
      instrument_name: position.instrumentName ?? `Instrument ${instrumentId}`,
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
    const rawPnl = round(toNumber(mirror.closedPositionsNetProfit))
    const rawMarketValue = round(
      toNumber(mirror.availableAmount) ||
        toNumber(mirror.initialInvestment) + rawPnl
    )
    const marketValue = convertBrokerAmount(rawMarketValue, fxContext)

    return {
      symbol: `MIRROR-${mirror.parentUsername ?? mirrorId}`,
      instrument_name: mirror.parentUsername
        ? `CopyTrader: ${mirror.parentUsername}`
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

export function normalizeEtoroData(args: {
  identity?: Record<string, unknown> | null
  pnl: { clientPortfolio?: RawClientPortfolio } | null
  fxContext: FxContext
}): NormalizedPortfolioData {
  const pnlClient = args.pnl?.clientPortfolio ?? {}

  const availableCash = convertBrokerAmount(
    toNumber(pnlClient.credit) +
      toNumber(pnlClient.bonusCredit),
    args.fxContext
  )
  const directHoldings = normalizePositions(pnlClient.positions ?? [], args.fxContext)
  const mirrorHoldings = normalizeMirrors(pnlClient.mirrors ?? [], args.fxContext)
  const holdings = [...directHoldings, ...mirrorHoldings]
  const holdingsValue = round(holdings.reduce((total, holding) => total + holding.market_value, 0))
  const totalAccountValue = round(availableCash + holdingsValue)
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
      identity: args.identity ?? null,
      pnl: args.pnl,
      currencies: {
        brokerCurrency: args.fxContext.brokerCurrency,
        fundCurrency: args.fxContext.fundCurrency,
        brokerToFundRate: args.fxContext.rate,
        source: args.fxContext.source,
        referenceDate: args.fxContext.referenceDate,
        accountCurrencyId: pnlClient.accountCurrencyId ?? null,
      },
      normalizedAt: new Date().toISOString(),
    },
  }
}
