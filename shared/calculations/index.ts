export type NumericLike = number | string | null | undefined

export type FundTransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'MANUAL_ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FEE'

export type Role = 'admin' | 'viewer'

export interface FundTransactionLike {
  id?: string
  member_id: string
  type: FundTransactionType
  date: string
  amount: NumericLike
  unit_price_at_time: NumericLike
  units_amount: NumericLike
  notes?: string | null
  counterparty_member_id?: string | null
  transfer_group_id?: string | null
}

export interface MemberLike {
  id: string
  name: string
  is_active: boolean
}

export interface PortfolioSnapshotLike {
  id: string
  captured_at: string
  total_account_value: NumericLike
  available_cash: NumericLike
  unrealized_pnl: NumericLike
  realized_pnl: NumericLike
  total_units: NumericLike
  unit_price: NumericLike
}

export interface HoldingSnapshotLike {
  id: string
  portfolio_snapshot_id: string
  symbol: string
  instrument_name: string | null
  quantity: NumericLike
  average_open: NumericLike
  current_price: NumericLike
  market_value: NumericLike
  pnl: NumericLike
  allocation_pct: NumericLike
}

export interface MemberUnitsSummary {
  unitsBought: number
  unitsSold: number
  transferUnitsIn: number
  transferUnitsOut: number
  netUnits: number
}

export interface MemberOpenLot {
  lotId: string
  sourceTransactionId?: string
  sourceType: FundTransactionType
  openedAt: string
  originalUnits: number
  remainingUnits: number
  originalAmount: number
  remainingCostBasis: number
  costPerUnit: number
}

export interface MemberLotDisposition {
  lotId: string
  sourceTransactionId?: string
  closingTransactionId?: string
  sourceType: FundTransactionType
  closingType: FundTransactionType
  closedAt: string
  units: number
  costBasis: number
  proceeds: number
  realizedReturn: number
}

export interface MemberLotSummary {
  openLots: MemberOpenLot[]
  dispositions: MemberLotDisposition[]
  remainingCostBasis: number
  averageCostPerUnit: number
  realizedReturn: number
  unrealizedReturn: number
  totalReturn: number
  openLotCount: number
  unmatchedUnitsClosed: number
  lastActivityAt: string | null
}

export interface MemberSummaryRow extends MemberUnitsSummary {
  id: string
  name: string
  isActive: boolean
  ownershipPct: number
  currentValue: number
  deposits: number
  withdrawals: number
  transferInAmount: number
  transferOutAmount: number
  manualAdjustments: number
  totalInvested: number
  totalReturned: number
  netInvested: number
  realizedReturn: number
  unrealizedReturn: number
  remainingCostBasis: number
  averageCostPerUnit: number
  openLotCount: number
  unmatchedUnitsClosed: number
  lastActivityAt: string | null
  totalReturn: number
  netPnl: number
}

export interface MemberReconciliationTargetLike {
  member_id: string
  target_units: NumericLike
  as_of_date: string
  notes?: string | null
  updated_at?: string
  updated_by?: string | null
}

export interface MemberReconciliationRow {
  memberId: string
  name: string
  isActive: boolean
  ledgerUnits: number
  ledgerValue: number
  targetUnits: number | null
  targetValue: number | null
  unitDiff: number | null
  valueDiff: number | null
  targetAsOfDate: string | null
  targetNotes: string | null
  status: 'missing_target' | 'matched' | 'needs_units_in' | 'needs_units_out'
}

export interface ReconciliationTransferSuggestion {
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  units: number
  indicativeAmount: number
}

export interface ReconciliationSummary {
  ledgerUnitsTotal: number
  targetedUnitsTotal: number
  matchedCount: number
  missingTargetCount: number
  unitsDelta: number
  valueDelta: number
}

export interface DashboardSummary {
  totalAccountValue: number
  availableCash: number
  totalUnits: number
  currentUnitPrice: number
  overallPerformancePct: number
  unrealizedPnl: number
  realizedPnl: number
  activeHoldingsCount: number
  memberCount: number
}

export interface SnapshotChartPoint {
  capturedAt: string
  totalAccountValue: number
  unitPrice: number
}

export interface AllocationPoint {
  name: string
  value: number
}

export interface HoldingRow {
  id: string
  symbol: string
  instrumentName: string
  quantity: number
  averageOpen: number
  currentPrice: number
  marketValue: number
  pnl: number
  allocationPct: number
}

export interface DashboardComputationInput {
  members: MemberLike[]
  transactions: FundTransactionLike[]
  latestSnapshot: PortfolioSnapshotLike | null
  latestHoldings: HoldingSnapshotLike[]
  startingUnitPrice?: NumericLike
}

export const DEFAULT_STARTING_UNIT_PRICE = 1

export function toNumber(value: NumericLike, fallback = 0): number {
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

export function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function getStartingUnitPrice(value?: NumericLike): number {
  const startingUnitPrice = toNumber(value, DEFAULT_STARTING_UNIT_PRICE)
  return startingUnitPrice > 0 ? startingUnitPrice : DEFAULT_STARTING_UNIT_PRICE
}

export function sortTransactionsByDate<T extends FundTransactionLike>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateDifference !== 0) {
      return dateDifference
    }

    return (a.id ?? '').localeCompare(b.id ?? '')
  })
}

export function filterTransactionsAsOf<T extends FundTransactionLike>(
  transactions: T[],
  asOfDate?: string | null
): T[] {
  if (!asOfDate) {
    return sortTransactionsByDate(transactions)
  }

  const cutoff = new Date(asOfDate).getTime()
  if (!Number.isFinite(cutoff)) {
    return sortTransactionsByDate(transactions)
  }

  return sortTransactionsByDate(
    transactions.filter((transaction) => new Date(transaction.date).getTime() <= cutoff)
  )
}

export function resolveSnapshotAsOf<T extends PortfolioSnapshotLike>(
  snapshots: T[],
  asOfDate?: string | null
): T | null {
  if (snapshots.length === 0) {
    return null
  }

  const sortedSnapshots = [...snapshots].sort(
    (left, right) => new Date(right.captured_at).getTime() - new Date(left.captured_at).getTime()
  )

  if (!asOfDate) {
    return sortedSnapshots[0] ?? null
  }

  const cutoff = new Date(asOfDate).getTime()
  if (!Number.isFinite(cutoff)) {
    return sortedSnapshots[0] ?? null
  }

  return sortedSnapshots.find((snapshot) => new Date(snapshot.captured_at).getTime() <= cutoff) ?? null
}

export function getSignedUnits(transaction: FundTransactionLike): number {
  const units = toNumber(transaction.units_amount)

  switch (transaction.type) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return units
    case 'WITHDRAWAL':
    case 'TRANSFER_OUT':
    case 'FEE':
      return -Math.abs(units)
    case 'MANUAL_ADJUSTMENT':
      return units
    default:
      return 0
  }
}

export function getSignedCashFlow(transaction: FundTransactionLike): number {
  const amount = toNumber(transaction.amount)

  switch (transaction.type) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return -Math.abs(amount)
    case 'WITHDRAWAL':
    case 'TRANSFER_OUT':
      return Math.abs(amount)
    case 'FEE':
      return -Math.abs(amount)
    case 'MANUAL_ADJUSTMENT':
      return amount
    default:
      return 0
  }
}

export function getMemberUnitsSummary(
  transactions: FundTransactionLike[],
  memberId: string
): MemberUnitsSummary {
  return transactions
    .filter((transaction) => transaction.member_id === memberId)
    .reduce<MemberUnitsSummary>(
      (summary, transaction) => {
        const units = toNumber(transaction.units_amount)

        switch (transaction.type) {
          case 'DEPOSIT':
            summary.unitsBought += units
            summary.netUnits += units
            break
          case 'TRANSFER_IN':
            summary.transferUnitsIn += units
            summary.unitsBought += units
            summary.netUnits += units
            break
          case 'WITHDRAWAL':
          case 'TRANSFER_OUT':
          case 'FEE':
            if (transaction.type === 'TRANSFER_OUT') {
              summary.transferUnitsOut += Math.abs(units)
            }
            summary.unitsSold += Math.abs(units)
            summary.netUnits -= Math.abs(units)
            break
          case 'MANUAL_ADJUSTMENT':
            if (units >= 0) {
              summary.unitsBought += units
            } else {
              summary.unitsSold += Math.abs(units)
            }
            summary.netUnits += units
            break
        }

        return summary
      },
      { unitsBought: 0, unitsSold: 0, transferUnitsIn: 0, transferUnitsOut: 0, netUnits: 0 }
    )
}

export function calculateMemberUnitsAsOf(
  transactions: FundTransactionLike[],
  memberId: string,
  asOfDate: string,
  options?: { excludeTransactionIds?: string[] }
): number {
  const cutoff = new Date(asOfDate).getTime()
  if (!Number.isFinite(cutoff)) {
    return 0
  }

  const excludedIds = new Set(options?.excludeTransactionIds ?? [])

  return round(
    sortTransactionsByDate(transactions).reduce((total, transaction) => {
      if (transaction.member_id !== memberId || excludedIds.has(transaction.id ?? '')) {
        return total
      }

      if (new Date(transaction.date).getTime() > cutoff) {
        return total
      }

      return total + getSignedUnits(transaction)
    }, 0),
    8
  )
}

export function calculateTotalUnitsOutstanding(transactions: FundTransactionLike[]): number {
  return round(
    transactions.reduce((total, transaction) => total + getSignedUnits(transaction), 0),
    8
  )
}

export function calculateCurrentUnitPrice(
  totalAccountValue: NumericLike,
  totalUnits: NumericLike,
  startingUnitPrice?: NumericLike
): number {
  const resolvedStartingPrice = getStartingUnitPrice(startingUnitPrice)
  const units = toNumber(totalUnits)
  if (units <= 0) {
    return resolvedStartingPrice
  }

  return round(toNumber(totalAccountValue) / units, 8)
}

export function calculateOwnershipPercentage(netUnits: NumericLike, totalUnits: NumericLike): number {
  const resolvedTotalUnits = toNumber(totalUnits)
  if (resolvedTotalUnits <= 0) {
    return 0
  }

  return round(toNumber(netUnits) / resolvedTotalUnits, 6)
}

export function calculateMemberCurrentValue(netUnits: NumericLike, currentUnitPrice: NumericLike): number {
  return round(toNumber(netUnits) * toNumber(currentUnitPrice), 6)
}

function isOpeningLotTransaction(transaction: FundTransactionLike) {
  const units = toNumber(transaction.units_amount)

  if (units <= 0) {
    return false
  }

  return (
    transaction.type === 'DEPOSIT' ||
    transaction.type === 'TRANSFER_IN' ||
    transaction.type === 'MANUAL_ADJUSTMENT'
  )
}

function isClosingLotTransaction(transaction: FundTransactionLike) {
  const units = toNumber(transaction.units_amount)

  if (units >= 0) {
    return false
  }

  return transaction.type === 'MANUAL_ADJUSTMENT'
}

function resolveOpeningLotAmount(transaction: FundTransactionLike) {
  const amount = toNumber(transaction.amount)

  switch (transaction.type) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return Math.abs(amount)
    case 'MANUAL_ADJUSTMENT':
      return Math.max(amount, 0)
    default:
      return 0
  }
}

function resolveClosingLotProceeds(transaction: FundTransactionLike) {
  const amount = toNumber(transaction.amount)

  switch (transaction.type) {
    case 'WITHDRAWAL':
    case 'TRANSFER_OUT':
      return Math.abs(amount)
    case 'FEE':
      return -Math.abs(amount)
    case 'MANUAL_ADJUSTMENT':
      return amount
    default:
      return 0
  }
}

export function buildMemberLotSummary(args: {
  transactions: FundTransactionLike[]
  currentUnitPrice: NumericLike
}): MemberLotSummary {
  const { transactions, currentUnitPrice } = args
  const openLots: MemberOpenLot[] = []
  const dispositions: MemberLotDisposition[] = []
  const sortedTransactions = sortTransactionsByDate(transactions)
  let realizedReturn = 0
  let unmatchedUnitsClosed = 0
  let lotSequence = 0

  sortedTransactions.forEach((transaction) => {
    const units = toNumber(transaction.units_amount)
    const isNegativeManualAdjustment = transaction.type === 'MANUAL_ADJUSTMENT' && units < 0

    if (isOpeningLotTransaction(transaction)) {
      const originalUnits = Math.abs(units)
      const originalAmount = round(resolveOpeningLotAmount(transaction), 6)
      const costPerUnit =
        originalUnits > 0 ? round(originalAmount / originalUnits, 10) : 0

      openLots.push({
        lotId: transaction.id ?? `lot-${lotSequence++}`,
        sourceTransactionId: transaction.id,
        sourceType: transaction.type,
        openedAt: transaction.date,
        originalUnits: round(originalUnits, 8),
        remainingUnits: round(originalUnits, 8),
        originalAmount,
        remainingCostBasis: originalAmount,
        costPerUnit,
      })
      return
    }

    if (
      transaction.type === 'WITHDRAWAL' ||
      transaction.type === 'TRANSFER_OUT' ||
      transaction.type === 'FEE' ||
      isClosingLotTransaction(transaction)
    ) {
      const totalUnitsToClose = round(Math.abs(units), 8)
      const totalProceeds = round(resolveClosingLotProceeds(transaction), 6)
      let remainingUnitsToClose = totalUnitsToClose

      if (totalUnitsToClose <= 0) {
        if (isNegativeManualAdjustment && units === 0) {
          realizedReturn += totalProceeds
        }
        return
      }

      for (const lot of openLots) {
        if (remainingUnitsToClose <= 0) {
          break
        }

        if (lot.remainingUnits <= 0) {
          continue
        }

        const unitsMatched = Math.min(lot.remainingUnits, remainingUnitsToClose)
        const costBasis = round(unitsMatched * lot.costPerUnit, 6)
        const proceeds = round(totalProceeds * (unitsMatched / totalUnitsToClose), 6)
        const lotRealizedReturn = round(proceeds - costBasis, 6)

        dispositions.push({
          lotId: lot.lotId,
          sourceTransactionId: lot.sourceTransactionId,
          closingTransactionId: transaction.id,
          sourceType: lot.sourceType,
          closingType: transaction.type,
          closedAt: transaction.date,
          units: round(unitsMatched, 8),
          costBasis,
          proceeds,
          realizedReturn: lotRealizedReturn,
        })

        lot.remainingUnits = round(lot.remainingUnits - unitsMatched, 8)
        lot.remainingCostBasis = round(lot.remainingCostBasis - costBasis, 6)
        remainingUnitsToClose = round(remainingUnitsToClose - unitsMatched, 8)
        realizedReturn = round(realizedReturn + lotRealizedReturn, 6)
      }

      if (remainingUnitsToClose > 0) {
        unmatchedUnitsClosed = round(unmatchedUnitsClosed + remainingUnitsToClose, 8)
      }

      return
    }

    if (transaction.type === 'MANUAL_ADJUSTMENT' && units === 0) {
      realizedReturn = round(realizedReturn + toNumber(transaction.amount), 6)
    }
  })

  const normalizedOpenLots = openLots
    .filter((lot) => lot.remainingUnits > 0)
    .map((lot) => ({
      ...lot,
      remainingUnits: round(lot.remainingUnits, 8),
      remainingCostBasis: round(lot.remainingCostBasis, 6),
    }))
  const remainingCostBasis = round(
    normalizedOpenLots.reduce((total, lot) => total + lot.remainingCostBasis, 0),
    6
  )
  const remainingUnits = round(
    normalizedOpenLots.reduce((total, lot) => total + lot.remainingUnits, 0),
    8
  )
  const currentValue = calculateMemberCurrentValue(remainingUnits, currentUnitPrice)
  const unrealizedReturn = round(currentValue - remainingCostBasis, 6)
  const lastActivityAt = sortedTransactions.at(-1)?.date ?? null

  return {
    openLots: normalizedOpenLots,
    dispositions,
    remainingCostBasis,
    averageCostPerUnit:
      remainingUnits > 0 ? round(remainingCostBasis / remainingUnits, 8) : 0,
    realizedReturn: round(realizedReturn, 6),
    unrealizedReturn,
    totalReturn: round(realizedReturn + unrealizedReturn, 6),
    openLotCount: normalizedOpenLots.length,
    unmatchedUnitsClosed,
    lastActivityAt,
  }
}

export function buildMemberSummaries(args: {
  members: MemberLike[]
  transactions: FundTransactionLike[]
  currentUnitPrice: NumericLike
}): MemberSummaryRow[] {
  const { members, transactions, currentUnitPrice } = args
  const totalUnits = calculateTotalUnitsOutstanding(transactions)

  return members
    .map<MemberSummaryRow>((member) => {
      const memberTransactions = transactions.filter((transaction) => transaction.member_id === member.id)
      const units = getMemberUnitsSummary(transactions, member.id)
      const lotSummary = buildMemberLotSummary({
        transactions: memberTransactions,
        currentUnitPrice,
      })
      const deposits = memberTransactions
        .filter((transaction) => transaction.type === 'DEPOSIT')
        .reduce((total, transaction) => total + Math.abs(toNumber(transaction.amount)), 0)
      const withdrawals = memberTransactions
        .filter((transaction) => transaction.type === 'WITHDRAWAL')
        .reduce((total, transaction) => total + Math.abs(toNumber(transaction.amount)), 0)
      const transferInAmount = memberTransactions
        .filter((transaction) => transaction.type === 'TRANSFER_IN')
        .reduce((total, transaction) => total + Math.abs(toNumber(transaction.amount)), 0)
      const transferOutAmount = memberTransactions
        .filter((transaction) => transaction.type === 'TRANSFER_OUT')
        .reduce((total, transaction) => total + Math.abs(toNumber(transaction.amount)), 0)
      const manualAdjustments = memberTransactions
        .filter((transaction) => transaction.type === 'MANUAL_ADJUSTMENT')
        .reduce((total, transaction) => total + toNumber(transaction.amount), 0)
      const currentValue = calculateMemberCurrentValue(units.netUnits, currentUnitPrice)
      const totalInvested = deposits + transferInAmount
      const totalReturned = withdrawals + transferOutAmount

      return {
        id: member.id,
        name: member.name,
        isActive: member.is_active,
        unitsBought: round(units.unitsBought, 8),
        unitsSold: round(units.unitsSold, 8),
        transferUnitsIn: round(units.transferUnitsIn, 8),
        transferUnitsOut: round(units.transferUnitsOut, 8),
        netUnits: round(units.netUnits, 8),
        ownershipPct: calculateOwnershipPercentage(units.netUnits, totalUnits),
        currentValue,
        deposits: round(deposits, 6),
        withdrawals: round(withdrawals, 6),
        transferInAmount: round(transferInAmount, 6),
        transferOutAmount: round(transferOutAmount, 6),
        manualAdjustments: round(manualAdjustments, 6),
        totalInvested: round(totalInvested, 6),
        totalReturned: round(totalReturned, 6),
        netInvested: round(totalInvested - totalReturned, 6),
        realizedReturn: lotSummary.realizedReturn,
        unrealizedReturn: lotSummary.unrealizedReturn,
        remainingCostBasis: lotSummary.remainingCostBasis,
        averageCostPerUnit: lotSummary.averageCostPerUnit,
        openLotCount: lotSummary.openLotCount,
        unmatchedUnitsClosed: lotSummary.unmatchedUnitsClosed,
        lastActivityAt: lotSummary.lastActivityAt,
        totalReturn: lotSummary.totalReturn,
        netPnl: lotSummary.totalReturn,
      }
    })
    .sort((left, right) => right.currentValue - left.currentValue || left.name.localeCompare(right.name))
}

export function buildHoldingsRows(holdings: HoldingSnapshotLike[]): HoldingRow[] {
  return holdings
    .map((holding) => ({
      id: holding.id,
      symbol: holding.symbol,
      instrumentName: holding.instrument_name ?? holding.symbol,
      quantity: round(toNumber(holding.quantity), 8),
      averageOpen: round(toNumber(holding.average_open), 8),
      currentPrice: round(toNumber(holding.current_price), 8),
      marketValue: round(toNumber(holding.market_value), 6),
      pnl: round(toNumber(holding.pnl), 6),
      allocationPct: round(toNumber(holding.allocation_pct), 6),
    }))
    .sort((left, right) => right.marketValue - left.marketValue || left.symbol.localeCompare(right.symbol))
}

export function buildSnapshotSeries(snapshots: PortfolioSnapshotLike[]): SnapshotChartPoint[] {
  return [...snapshots]
    .sort((left, right) => new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime())
    .map((snapshot) => ({
      capturedAt: snapshot.captured_at,
      totalAccountValue: round(toNumber(snapshot.total_account_value), 6),
      unitPrice: round(toNumber(snapshot.unit_price), 8),
    }))
}

export function buildOwnershipAllocation(memberSummaries: MemberSummaryRow[]): AllocationPoint[] {
  return memberSummaries
    .filter((member) => member.netUnits > 0)
    .map((member) => ({
      name: member.name,
      value: round(member.ownershipPct * 100, 4),
    }))
}

export function buildHoldingsAllocation(holdings: HoldingSnapshotLike[]): AllocationPoint[] {
  return buildHoldingsRows(holdings)
    .filter((holding) => holding.marketValue > 0)
    .map((holding) => ({
      name: holding.symbol,
      value: round(holding.allocationPct * 100, 4),
    }))
}

export function buildMemberReconciliationRows(args: {
  members: MemberLike[]
  transactions: FundTransactionLike[]
  reconciliationTargets: MemberReconciliationTargetLike[]
  currentUnitPrice: NumericLike
  asOfDate?: string | null
}): MemberReconciliationRow[] {
  const { members, transactions, reconciliationTargets, currentUnitPrice, asOfDate } = args
  const targetByMemberId = new Map(
    reconciliationTargets.map((target) => [target.member_id, target] as const)
  )
  const resolvedAsOfDate = asOfDate ?? null

  return members
    .map<MemberReconciliationRow>((member) => {
      const ledgerUnits = resolvedAsOfDate
        ? calculateMemberUnitsAsOf(transactions, member.id, resolvedAsOfDate)
        : getMemberUnitsSummary(transactions, member.id).netUnits
      const ledgerValue = calculateMemberCurrentValue(ledgerUnits, currentUnitPrice)
      const target = targetByMemberId.get(member.id)
      const targetUnits = target ? round(toNumber(target.target_units), 8) : null
      const targetValue =
        targetUnits !== null ? calculateMemberCurrentValue(targetUnits, currentUnitPrice) : null
      const unitDiff =
        targetUnits !== null ? round(targetUnits - round(ledgerUnits, 8), 8) : null
      const valueDiff =
        unitDiff !== null ? calculateMemberCurrentValue(unitDiff, currentUnitPrice) : null
      const status: MemberReconciliationRow['status'] =
        targetUnits === null
          ? 'missing_target'
          : Math.abs(unitDiff ?? 0) <= 0.00000001
            ? 'matched'
            : (unitDiff ?? 0) > 0
              ? 'needs_units_in'
              : 'needs_units_out'

      return {
        memberId: member.id,
        name: member.name,
        isActive: member.is_active,
        ledgerUnits: round(ledgerUnits, 8),
        ledgerValue,
        targetUnits,
        targetValue,
        unitDiff,
        valueDiff,
        targetAsOfDate: target?.as_of_date ?? null,
        targetNotes: target?.notes ?? null,
        status,
      }
    })
    .sort((left, right) => {
      const leftPriority = left.status === 'matched' ? 1 : left.status === 'missing_target' ? 2 : 0
      const rightPriority = right.status === 'matched' ? 1 : right.status === 'missing_target' ? 2 : 0

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      const rightDiff = Math.abs(right.unitDiff ?? 0)
      const leftDiff = Math.abs(left.unitDiff ?? 0)
      if (rightDiff !== leftDiff) {
        return rightDiff - leftDiff
      }

      return left.name.localeCompare(right.name)
    })
}

export function summarizeMemberReconciliation(
  rows: MemberReconciliationRow[],
  currentUnitPrice: NumericLike
): ReconciliationSummary {
  const ledgerUnitsTotal = round(rows.reduce((total, row) => total + row.ledgerUnits, 0), 8)
  const targetedUnitsTotal = round(
    rows.reduce((total, row) => total + (row.targetUnits ?? 0), 0),
    8
  )
  const unitsDelta = round(targetedUnitsTotal - ledgerUnitsTotal, 8)
  const valueDelta = calculateMemberCurrentValue(unitsDelta, currentUnitPrice)

  return {
    ledgerUnitsTotal,
    targetedUnitsTotal,
    matchedCount: rows.filter((row) => row.status === 'matched').length,
    missingTargetCount: rows.filter((row) => row.status === 'missing_target').length,
    unitsDelta,
    valueDelta,
  }
}

export function buildReconciliationTransferSuggestions(args: {
  rows: MemberReconciliationRow[]
  currentUnitPrice: NumericLike
}): ReconciliationTransferSuggestion[] {
  const { rows, currentUnitPrice } = args
  const sellers = rows
    .filter((row) => row.status === 'needs_units_out' && (row.unitDiff ?? 0) < 0)
    .map((row) => ({
      memberId: row.memberId,
      name: row.name,
      remainingUnits: Math.abs(row.unitDiff ?? 0),
    }))
  const buyers = rows
    .filter((row) => row.status === 'needs_units_in' && (row.unitDiff ?? 0) > 0)
    .map((row) => ({
      memberId: row.memberId,
      name: row.name,
      remainingUnits: row.unitDiff ?? 0,
    }))
  const suggestions: ReconciliationTransferSuggestion[] = []

  for (const seller of sellers) {
    for (const buyer of buyers) {
      if (seller.remainingUnits <= 0) {
        break
      }

      if (buyer.remainingUnits <= 0) {
        continue
      }

      const units = round(Math.min(seller.remainingUnits, buyer.remainingUnits), 8)
      if (units <= 0) {
        continue
      }

      suggestions.push({
        fromMemberId: seller.memberId,
        fromMemberName: seller.name,
        toMemberId: buyer.memberId,
        toMemberName: buyer.name,
        units,
        indicativeAmount: calculateMemberCurrentValue(units, currentUnitPrice),
      })

      seller.remainingUnits = round(seller.remainingUnits - units, 8)
      buyer.remainingUnits = round(buyer.remainingUnits - units, 8)
    }
  }

  return suggestions
}

export function computeDashboardSummary({
  members,
  transactions,
  latestSnapshot,
  latestHoldings,
  startingUnitPrice,
}: DashboardComputationInput): DashboardSummary {
  const totalUnits = calculateTotalUnitsOutstanding(transactions)
  const totalAccountValue = latestSnapshot ? toNumber(latestSnapshot.total_account_value) : 0
  const currentUnitPrice = latestSnapshot
    ? calculateCurrentUnitPrice(totalAccountValue, totalUnits, startingUnitPrice)
    : getStartingUnitPrice(startingUnitPrice)
  const resolvedStartingUnitPrice = getStartingUnitPrice(startingUnitPrice)

  return {
    totalAccountValue: round(totalAccountValue, 6),
    availableCash: round(latestSnapshot ? toNumber(latestSnapshot.available_cash) : 0, 6),
    totalUnits,
    currentUnitPrice,
    overallPerformancePct:
      resolvedStartingUnitPrice > 0
        ? round(currentUnitPrice / resolvedStartingUnitPrice - 1, 6)
        : 0,
    unrealizedPnl: round(latestSnapshot ? toNumber(latestSnapshot.unrealized_pnl) : 0, 6),
    realizedPnl: round(latestSnapshot ? toNumber(latestSnapshot.realized_pnl) : 0, 6),
    activeHoldingsCount: latestHoldings.filter((holding) => toNumber(holding.market_value) > 0).length,
    memberCount: members.filter((member) => member.is_active).length,
  }
}
