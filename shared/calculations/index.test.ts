import {
  buildMemberHistorySeries,
  buildMemberLotSummary,
  buildMemberSummaries,
  buildSnapshotSeries,
  calculateCurrentUnitPrice,
  calculateMemberUnitsAsOf,
  calculateTotalUnitsOutstanding,
  computeDashboardSummary,
  filterTransactionsAsOf,
  resolvePerformanceBaselineSnapshot,
  resolveSnapshotAsOf,
  type FundTransactionLike,
  type MemberLike,
  type PortfolioSnapshotLike,
} from './index'

const members: MemberLike[] = [
  { id: 'a', name: 'Alpha', is_active: true },
  { id: 'b', name: 'Bravo', is_active: true },
]

const transactions: FundTransactionLike[] = [
  {
    member_id: 'a',
    type: 'DEPOSIT',
    amount: 100,
    unit_price_at_time: 1,
    units_amount: 100,
    date: '2025-11-22T00:00:00.000Z',
  },
  {
    member_id: 'b',
    type: 'DEPOSIT',
    amount: 50,
    unit_price_at_time: 1,
    units_amount: 50,
    date: '2025-11-22T00:00:00.000Z',
  },
  {
    member_id: 'a',
    type: 'WITHDRAWAL',
    amount: 20,
    unit_price_at_time: 1.25,
    units_amount: 16,
    date: '2025-12-01T00:00:00.000Z',
  },
  {
    member_id: 'b',
    type: 'MANUAL_ADJUSTMENT',
    amount: -5,
    unit_price_at_time: 1.25,
    units_amount: -4,
    date: '2025-12-02T00:00:00.000Z',
  },
  {
    id: 'transfer-out-1',
    member_id: 'a',
    counterparty_member_id: 'b',
    transfer_group_id: 'transfer-1',
    type: 'TRANSFER_OUT',
    amount: 15,
    unit_price_at_time: 1.5,
    units_amount: 10,
    date: '2025-12-05T00:00:00.000Z',
  },
  {
    id: 'transfer-in-1',
    member_id: 'b',
    counterparty_member_id: 'a',
    transfer_group_id: 'transfer-1',
    type: 'TRANSFER_IN',
    amount: 15,
    unit_price_at_time: 1.5,
    units_amount: 10,
    date: '2025-12-05T00:00:00.000Z',
  },
]

const latestSnapshot: PortfolioSnapshotLike = {
  id: 'snapshot-1',
  captured_at: '2025-12-10T00:00:00.000Z',
  total_account_value: 180,
  available_cash: 25,
  unrealized_pnl: 12,
  realized_pnl: 8,
  total_units: 130,
  unit_price: 1.38461538,
}

const baselineSnapshot: PortfolioSnapshotLike = {
  id: 'snapshot-0',
  captured_at: '2025-12-01T00:00:00.000Z',
  total_account_value: 150,
  available_cash: 0,
  unrealized_pnl: 0,
  realized_pnl: 0,
  total_units: 150,
  unit_price: 1,
  raw_json: {
    scheduler: {
      trigger: 'scheduled_hourly_sync',
    },
  },
}

describe('shared calculations', () => {
  it('calculates total units with deposits, withdrawals, adjustments, and transfers', () => {
    expect(calculateTotalUnitsOutstanding(transactions)).toBe(130)
  })

  it('falls back to starting unit price when no units exist', () => {
    expect(calculateCurrentUnitPrice(0, 0, 1)).toBe(1)
  })

  it('builds deterministic member summaries', () => {
    const summaries = buildMemberSummaries({
      members,
      transactions,
      currentUnitPrice: 180 / 130,
    })

    expect(summaries[0]).toMatchObject({
      name: 'Alpha',
      unitsBought: 100,
      unitsSold: 26,
      transferUnitsOut: 10,
      netUnits: 74,
      fundDeposits: 100,
      fundWithdrawals: 20,
      secondarySaleProceeds: 15,
      realizedReturn: 9,
    })
    expect(summaries[1]).toMatchObject({
      name: 'Bravo',
      unitsBought: 60,
      unitsSold: 4,
      transferUnitsIn: 10,
      netUnits: 56,
      fundDeposits: 50,
      fundWithdrawals: 0,
      secondaryPurchaseCost: 15,
      realizedReturn: -9,
    })

    expect(summaries.reduce((total, member) => total + member.fundDeposits, 0)).toBe(150)
    expect(summaries.reduce((total, member) => total + member.fundWithdrawals, 0)).toBe(20)
    expect(summaries.reduce((total, member) => total + member.secondaryPurchaseCost, 0)).toBe(15)
    expect(summaries.reduce((total, member) => total + member.secondarySaleProceeds, 0)).toBe(15)
  })

  it('separates fund cash from private transfer cost basis for Gay and Miller style transfers', () => {
    const transferMembers: MemberLike[] = [
      { id: 'gay', name: 'GAY', is_active: true },
      { id: 'miller', name: 'MILLER', is_active: true },
    ]
    const transferTransactions: FundTransactionLike[] = [
      {
        id: 'gay-deposit',
        member_id: 'gay',
        type: 'DEPOSIT',
        amount: 50,
        unit_price_at_time: 1,
        units_amount: 50,
        date: '2025-11-22T00:00:00.000Z',
      },
      {
        id: 'miller-deposit',
        member_id: 'miller',
        type: 'DEPOSIT',
        amount: 50,
        unit_price_at_time: 1,
        units_amount: 50,
        date: '2025-11-22T00:00:00.000Z',
      },
      {
        id: 'miller-transfer-out',
        member_id: 'miller',
        counterparty_member_id: 'gay',
        transfer_group_id: 'transfer-gay-miller',
        type: 'TRANSFER_OUT',
        amount: 45,
        unit_price_at_time: 0.9,
        units_amount: 50,
        date: '2026-03-24T12:00:00.000Z',
      },
      {
        id: 'gay-transfer-in',
        member_id: 'gay',
        counterparty_member_id: 'miller',
        transfer_group_id: 'transfer-gay-miller',
        type: 'TRANSFER_IN',
        amount: 45,
        unit_price_at_time: 0.9,
        units_amount: 50,
        date: '2026-03-24T12:00:00.000Z',
      },
    ]

    const summaries = buildMemberSummaries({
      members: transferMembers,
      transactions: transferTransactions,
      currentUnitPrice: 0.85509126,
    })

    const gaySummary = summaries.find((member) => member.name === 'GAY')
    const millerSummary = summaries.find((member) => member.name === 'MILLER')

    expect(gaySummary).toMatchObject({
      fundDeposits: 50,
      secondaryPurchaseCost: 45,
      remainingCostBasis: 95,
      netUnits: 100,
      currentValue: 85.509126,
    })
    expect(millerSummary).toMatchObject({
      fundDeposits: 50,
      secondarySaleProceeds: 45,
      remainingCostBasis: 0,
      netUnits: 0,
      realizedReturn: -5,
    })
  })

  it('builds FIFO lot summaries with realized and unrealized returns', () => {
    const alphaTransactions = transactions.filter((transaction) => transaction.member_id === 'a')
    const lotSummary = buildMemberLotSummary({
      transactions: alphaTransactions,
      currentUnitPrice: 180 / 130,
    })

    expect(lotSummary.openLotCount).toBe(1)
    expect(lotSummary.remainingCostBasis).toBe(74)
    expect(lotSummary.realizedReturn).toBe(9)
    expect(lotSummary.unrealizedReturn).toBeCloseTo(28.461538, 5)
    expect(lotSummary.totalReturn).toBeCloseTo(37.461538, 5)
  })

  it('calculates units available for a member as of a chosen date', () => {
    expect(calculateMemberUnitsAsOf(transactions, 'a', '2025-12-04T00:00:00.000Z')).toBe(84)
    expect(calculateMemberUnitsAsOf(transactions, 'a', '2025-12-06T00:00:00.000Z')).toBe(74)
    expect(
      calculateMemberUnitsAsOf(transactions, 'a', '2025-12-06T00:00:00.000Z', {
        excludeTransactionIds: ['transfer-out-1'],
      })
    ).toBe(84)
  })

  it('filters transactions and resolves the correct snapshot as of a chosen date', () => {
    const filteredTransactions = filterTransactionsAsOf(transactions, '2025-12-03T23:59:59.999Z')
    expect(filteredTransactions).toHaveLength(4)

    const resolvedSnapshot = resolveSnapshotAsOf(
      [
        latestSnapshot,
        {
          ...latestSnapshot,
          id: 'snapshot-0',
          captured_at: '2025-12-01T00:00:00.000Z',
          total_account_value: 150,
          unit_price: 1,
        },
      ],
      '2025-12-02T00:00:00.000Z'
    )

    expect(resolvedSnapshot?.id).toBe('snapshot-0')
  })

  it('computes dashboard summary using latest snapshot plus transactions', () => {
    const summary = computeDashboardSummary({
      members,
      transactions,
      snapshots: [baselineSnapshot, latestSnapshot],
      latestSnapshot,
      latestHoldings: [],
      startingUnitPrice: 1,
    })

    expect(summary.totalUnits).toBe(130)
    expect(summary.totalAccountValue).toBe(180)
    expect(summary.currentUnitPrice).toBeCloseTo(1.38461538, 6)
    expect(summary.performanceBaselineUnitPrice).toBe(1)
    expect(summary.performanceBaselineCapturedAt).toBe('2025-12-01T00:00:00.000Z')
    expect(summary.overallPerformancePct).toBeCloseTo(0.384615, 6)
  })

  it('resolves the performance baseline from the first snapshot on or after a configured date', () => {
    const baseline = resolvePerformanceBaselineSnapshot({
      snapshots: [
        {
          ...baselineSnapshot,
          raw_json: null,
        },
        latestSnapshot,
      ],
      performanceBaselineAt: '2025-12-05T00:00:00.000Z',
    })

    expect(baseline?.id).toBe('snapshot-1')
  })

  it('creates snapshot chart points in chronological order', () => {
    const points = buildSnapshotSeries([
      latestSnapshot,
      baselineSnapshot,
    ])

    expect(points[0]?.capturedAt).toBe('2025-12-01T00:00:00.000Z')
    expect(points[1]?.totalAccountValue).toBe(180)
  })

  it('builds a member-specific value series across snapshots', () => {
    const historySnapshots: PortfolioSnapshotLike[] = [
      {
        id: 'history-1',
        captured_at: '2025-11-25T00:00:00.000Z',
        total_account_value: 150,
        available_cash: 0,
        unrealized_pnl: 0,
        realized_pnl: 0,
        total_units: 150,
        unit_price: 1,
      },
      {
        id: 'history-2',
        captured_at: '2025-12-06T00:00:00.000Z',
        total_account_value: 180,
        available_cash: 0,
        unrealized_pnl: 0,
        realized_pnl: 0,
        total_units: 130,
        unit_price: 180 / 130,
      },
    ]

    const memberHistory = buildMemberHistorySeries({
      memberId: 'b',
      transactions,
      snapshots: historySnapshots,
    })

    expect(memberHistory[0]).toMatchObject({
      units: 50,
      currentValue: 50,
      ownershipPct: 0.333333,
    })
    expect(memberHistory[1]).toMatchObject({
      units: 56,
      currentValue: 77.538461,
      ownershipPct: 0.430769,
    })
  })
})
