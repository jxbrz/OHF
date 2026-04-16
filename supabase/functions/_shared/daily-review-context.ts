export interface DailyReviewHoldingSummary {
  symbol: string
  instrumentName: string | null
  closeMarketValue: number
  openMarketValue: number
  changeAmount: number
  closeAllocationPct: number | null
  openQuantity: number
  closeQuantity: number
}

export interface DailyReviewAllocationSummary {
  symbol: string
  instrumentName: string | null
  closeMarketValue: number
  closeAllocationPct: number | null
}

export interface DailyReviewContext {
  reviewDate: string
  closingSnapshotId: string
  openingSnapshotId: string
  closingCapturedAt: string
  openingCapturedAt: string
  totalAccountValueOpen: number
  totalAccountValueClose: number
  totalAccountValueChange: number
  totalAccountValueChangePct: number
  unitPriceOpen: number
  unitPriceClose: number
  unitPriceChange: number
  unitPriceChangePct: number
  availableCashClose: number | null
  unrealizedPnlClose: number | null
  realizedPnlClose: number | null
  holdingsCountClose: number
  topHoldingMoves: DailyReviewHoldingSummary[]
  topAllocationsClose: DailyReviewAllocationSummary[]
  openedPositions: string[]
  closedPositions: string[]
}

interface SnapshotLike {
  id: string
  captured_at: string
  total_account_value: number
  available_cash: number | null
  unrealized_pnl: number | null
  realized_pnl: number | null
  unit_price: number
}

interface HoldingLike {
  symbol: string
  instrument_name: string | null
  quantity: number | null
  market_value: number | null
  allocation_pct: number | null
}

function toUtcDateString(value: string) {
  return value.slice(0, 10)
}

function roundNumber(value: number, fractionDigits = 2) {
  return Number(value.toFixed(fractionDigits))
}

export function buildDailyReviewContext(args: {
  reviewDate?: string | null
  snapshots: SnapshotLike[]
  openingHoldings: HoldingLike[]
  closingHoldings: HoldingLike[]
}): DailyReviewContext | null {
  const sortedSnapshots = [...args.snapshots].sort(
    (left, right) => new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime()
  )

  if (sortedSnapshots.length === 0) {
    return null
  }

  const explicitReviewDate = args.reviewDate?.trim() || null
  const derivedReviewDate =
    explicitReviewDate ?? toUtcDateString(sortedSnapshots.at(-1)?.captured_at ?? new Date().toISOString())

  const snapshotsOnDate = sortedSnapshots.filter(
    (snapshot) => toUtcDateString(snapshot.captured_at) === derivedReviewDate
  )

  if (snapshotsOnDate.length === 0) {
    return null
  }

  const openingSnapshot = snapshotsOnDate[0]
  const closingSnapshot = snapshotsOnDate.at(-1) ?? openingSnapshot
  const comparisonSnapshot =
    sortedSnapshots
      .filter((snapshot) => new Date(snapshot.captured_at).getTime() < new Date(openingSnapshot.captured_at).getTime())
      .at(-1) ?? openingSnapshot

  const openingHoldingsMap = new Map(
    args.openingHoldings.map((holding) => [holding.symbol, holding])
  )
  const closingHoldingsMap = new Map(
    args.closingHoldings.map((holding) => [holding.symbol, holding])
  )
  const allSymbols = new Set([...openingHoldingsMap.keys(), ...closingHoldingsMap.keys()])

  const holdingMoves = [...allSymbols]
    .map((symbol) => {
      const openingHolding = openingHoldingsMap.get(symbol)
      const closingHolding = closingHoldingsMap.get(symbol)
      const openMarketValue = Number(openingHolding?.market_value ?? 0)
      const closeMarketValue = Number(closingHolding?.market_value ?? 0)
      const openQuantity = Number(openingHolding?.quantity ?? 0)
      const closeQuantity = Number(closingHolding?.quantity ?? 0)

      return {
        symbol,
        instrumentName: closingHolding?.instrument_name ?? openingHolding?.instrument_name ?? null,
        openMarketValue: roundNumber(openMarketValue),
        closeMarketValue: roundNumber(closeMarketValue),
        changeAmount: roundNumber(closeMarketValue - openMarketValue),
        closeAllocationPct:
          closingHolding?.allocation_pct !== null && closingHolding?.allocation_pct !== undefined
            ? Number(closingHolding.allocation_pct)
            : null,
        openQuantity,
        closeQuantity,
      }
    })
    .sort((left, right) => Math.abs(right.changeAmount) - Math.abs(left.changeAmount))

  const openedPositions = holdingMoves
    .filter((holding) => holding.openQuantity <= 0 && holding.closeQuantity > 0)
    .map((holding) => holding.symbol)

  const closedPositions = holdingMoves
    .filter((holding) => holding.openQuantity > 0 && holding.closeQuantity <= 0)
    .map((holding) => holding.symbol)

  const topAllocationsClose = [...(args.closingHoldings ?? [])]
    .map((holding) => ({
      symbol: holding.symbol,
      instrumentName: holding.instrument_name ?? null,
      closeMarketValue: roundNumber(Number(holding.market_value ?? 0)),
      closeAllocationPct:
        holding.allocation_pct !== null && holding.allocation_pct !== undefined
          ? Number(holding.allocation_pct)
          : null,
    }))
    .filter((holding) => holding.closeMarketValue > 0)
    .sort((left, right) => right.closeMarketValue - left.closeMarketValue)
    .slice(0, 3)

  const totalAccountValueChange = roundNumber(
    Number(closingSnapshot.total_account_value) - Number(comparisonSnapshot.total_account_value)
  )
  const totalAccountValueChangePct =
    Number(comparisonSnapshot.total_account_value) > 0
      ? totalAccountValueChange / Number(comparisonSnapshot.total_account_value)
      : 0
  const unitPriceChange = roundNumber(
    Number(closingSnapshot.unit_price) - Number(comparisonSnapshot.unit_price),
    6
  )
  const unitPriceChangePct =
    Number(comparisonSnapshot.unit_price) > 0
      ? unitPriceChange / Number(comparisonSnapshot.unit_price)
      : 0

  return {
    reviewDate: derivedReviewDate,
    closingSnapshotId: closingSnapshot.id,
    openingSnapshotId: comparisonSnapshot.id,
    closingCapturedAt: closingSnapshot.captured_at,
    openingCapturedAt: comparisonSnapshot.captured_at,
    totalAccountValueOpen: Number(comparisonSnapshot.total_account_value),
    totalAccountValueClose: Number(closingSnapshot.total_account_value),
    totalAccountValueChange,
    totalAccountValueChangePct,
    unitPriceOpen: Number(comparisonSnapshot.unit_price),
    unitPriceClose: Number(closingSnapshot.unit_price),
    unitPriceChange,
    unitPriceChangePct,
    availableCashClose:
      closingSnapshot.available_cash !== null && closingSnapshot.available_cash !== undefined
        ? Number(closingSnapshot.available_cash)
        : null,
    unrealizedPnlClose:
      closingSnapshot.unrealized_pnl !== null && closingSnapshot.unrealized_pnl !== undefined
        ? Number(closingSnapshot.unrealized_pnl)
        : null,
    realizedPnlClose:
      closingSnapshot.realized_pnl !== null && closingSnapshot.realized_pnl !== undefined
        ? Number(closingSnapshot.realized_pnl)
        : null,
    holdingsCountClose: args.closingHoldings.filter((holding) => Number(holding.quantity ?? 0) > 0).length,
    topHoldingMoves: holdingMoves.slice(0, 4),
    topAllocationsClose,
    openedPositions,
    closedPositions,
  }
}
