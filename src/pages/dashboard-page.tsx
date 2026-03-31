import { useState } from 'react'
import {
  buildMemberSummaries,
  calculateCurrentUnitPrice,
  calculateTotalUnitsOutstanding,
  filterTransactionsAsOf,
  resolveSnapshotAsOf,
  sortTransactionsByDate,
} from '@shared/calculations'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, NotebookTabs } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { MetricCard } from '@/components/shared/metric-card'
import { PageHeader } from '@/components/shared/page-header'
import { SortableHeader } from '@/components/shared/sortable-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import { fetchClubData } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/formatters'
import { sortItems, type SortConfig } from '@/lib/sorting'
import { getTransferCounterpartyName } from '@/lib/transfers'

type LedgerSortKey =
  | 'name'
  | 'lastActivityAt'
  | 'netUnits'
  | 'ownershipPct'
  | 'totalInvested'
  | 'totalReturned'
  | 'remainingCostBasis'
  | 'currentValue'
  | 'realizedReturn'
  | 'unrealizedReturn'
  | 'totalReturn'
  | 'openLotCount'

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <Skeleton className="h-[34rem] rounded-2xl" />
        <div className="grid gap-6">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function getAsOfCutoff(selectedDate: string) {
  if (!selectedDate) {
    return null
  }

  const value = new Date(`${selectedDate}T23:59:59.999`)
  return Number.isFinite(value.getTime()) ? value.toISOString() : null
}

export function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig<LedgerSortKey>>({
    key: 'currentValue',
    direction: 'desc',
  })
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={Activity}
        title="Unable to load ownership ledger"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown ownership error.'}
      />
    )
  }

  const data = clubQuery.data
  if (!data) {
    return <DashboardSkeleton />
  }

  const asOfCutoff = getAsOfCutoff(selectedDate)
  const scopedTransactions = filterTransactionsAsOf(data.transactions, asOfCutoff)
  const scopedSnapshot = resolveSnapshotAsOf(data.snapshots, asOfCutoff)
  const totalUnits = calculateTotalUnitsOutstanding(scopedTransactions)
  const fundValue = scopedSnapshot
    ? Number(scopedSnapshot.total_account_value)
    : Number((totalUnits * data.startingUnitPrice).toFixed(6))
  const currentUnitPrice = scopedSnapshot
    ? calculateCurrentUnitPrice(fundValue, totalUnits, data.startingUnitPrice)
    : calculateCurrentUnitPrice(fundValue, totalUnits, data.startingUnitPrice)
  const rawMemberSummaries = buildMemberSummaries({
    members: data.members,
    transactions: scopedTransactions,
    currentUnitPrice,
  })
  const memberSummaries = sortItems(rawMemberSummaries, sortConfig, {
    lastActivityAt: (item) => item.lastActivityAt ?? '',
    netUnits: (item) => item.netUnits,
    ownershipPct: (item) => item.ownershipPct,
    totalInvested: (item) => item.totalInvested,
    totalReturned: (item) => item.totalReturned,
    remainingCostBasis: (item) => item.remainingCostBasis,
    currentValue: (item) => item.currentValue,
    realizedReturn: (item) => item.realizedReturn,
    unrealizedReturn: (item) => item.unrealizedReturn,
    totalReturn: (item) => item.totalReturn,
    openLotCount: (item) => item.openLotCount,
  })
  const activeOwners = rawMemberSummaries.filter((member) => member.netUnits > 0)
  const realizedReturn = rawMemberSummaries.reduce((total, member) => total + member.realizedReturn, 0)
  const unrealizedReturn = rawMemberSummaries.reduce((total, member) => total + member.unrealizedReturn, 0)
  const totalInvested = rawMemberSummaries.reduce((total, member) => total + member.totalInvested, 0)
  const totalReturned = rawMemberSummaries.reduce((total, member) => total + member.totalReturned, 0)
  const ownershipWarnings = rawMemberSummaries.filter(
    (member) => member.unmatchedUnitsClosed > 0 || member.netUnits < 0
  )
  const recentTransactions = sortTransactionsByDate(scopedTransactions).slice(-8).reverse()
  const memberNameById = new Map(data.members.map((member) => [member.id, member.name]))

  const toggleSort = (key: LedgerSortKey) =>
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ownership ledger"
        description={`Track who owns what, how their units were acquired, and how returns are split between realized and unrealized performance. ${
          asOfCutoff
            ? `Showing balances as of ${formatDate(asOfCutoff)}.`
            : data.latestSnapshot
              ? `Live view anchored to the latest snapshot captured ${formatDateTime(data.latestSnapshot.captured_at)}.`
              : 'No broker snapshot yet, so the ledger is using the configured starting unit price.'
        }`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                As of date
              </span>
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedDate('')}
            >
              Latest view
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Fund value"
          value={formatCurrency(fundValue)}
          secondary={
            scopedSnapshot
              ? `Snapshot ${formatDateTime(scopedSnapshot.captured_at)}`
              : 'Derived from starting unit price'
          }
        />
        <MetricCard
          label="Unit price"
          value={formatCurrency(currentUnitPrice)}
          secondary={`Units outstanding ${formatNumber(totalUnits, 6)}`}
        />
        <MetricCard
          label="Active owners"
          value={String(activeOwners.length)}
          secondary={`${rawMemberSummaries.length} total members on ledger`}
        />
        <MetricCard
          label="Open lots"
          value={String(rawMemberSummaries.reduce((total, member) => total + member.openLotCount, 0))}
          secondary="FIFO lots still held across all members"
        />
        <MetricCard
          label="Total invested"
          value={formatCurrency(totalInvested)}
          secondary={`Cash returned ${formatCurrency(totalReturned)}`}
        />
        <MetricCard
          label="Realized return"
          tone={realizedReturn >= 0 ? 'positive' : 'negative'}
          value={formatCurrency(realizedReturn)}
          secondary="Closed lots and cash-only adjustments"
        />
        <MetricCard
          label="Unrealized return"
          tone={unrealizedReturn >= 0 ? 'positive' : 'negative'}
          value={formatCurrency(unrealizedReturn)}
          secondary="Current value minus remaining cost basis"
        />
        <MetricCard
          label="Ledger warnings"
          tone={ownershipWarnings.length > 0 ? 'negative' : 'neutral'}
          value={String(ownershipWarnings.length)}
          secondary={
            ownershipWarnings.length > 0
              ? 'Members need ledger review'
              : 'No oversold or unmatched lot issues'
          }
        />
      </div>
      {memberSummaries.length === 0 ? (
        <EmptyState
          icon={NotebookTabs}
          title="No ownership data"
          description="Create members and transactions first so the ledger can build ownership and return positions."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
          <div className="panel-surface overflow-x-auto">
            <div className="border-b border-border/70 px-5 py-4">
              <h2 className="text-lg font-semibold">Member ownership register</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                FIFO lot accounting, current holdings, and return attribution per member.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'name'}
                      direction={sortConfig.direction}
                      label="Member"
                      onClick={() => toggleSort('name')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'lastActivityAt'}
                      direction={sortConfig.direction}
                      label="Last activity"
                      onClick={() => toggleSort('lastActivityAt')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'netUnits'}
                      direction={sortConfig.direction}
                      label="Net units"
                      onClick={() => toggleSort('netUnits')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'ownershipPct'}
                      direction={sortConfig.direction}
                      label="Ownership"
                      onClick={() => toggleSort('ownershipPct')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'totalInvested'}
                      direction={sortConfig.direction}
                      label="Invested"
                      onClick={() => toggleSort('totalInvested')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'totalReturned'}
                      direction={sortConfig.direction}
                      label="Returned"
                      onClick={() => toggleSort('totalReturned')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'remainingCostBasis'}
                      direction={sortConfig.direction}
                      label="Cost basis"
                      onClick={() => toggleSort('remainingCostBasis')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'currentValue'}
                      direction={sortConfig.direction}
                      label="Current value"
                      onClick={() => toggleSort('currentValue')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'realizedReturn'}
                      direction={sortConfig.direction}
                      label="Realized"
                      onClick={() => toggleSort('realizedReturn')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'unrealizedReturn'}
                      direction={sortConfig.direction}
                      label="Unrealized"
                      onClick={() => toggleSort('unrealizedReturn')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'totalReturn'}
                      direction={sortConfig.direction}
                      label="Total return"
                      onClick={() => toggleSort('totalReturn')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      active={sortConfig.key === 'openLotCount'}
                      direction={sortConfig.direction}
                      label="Lots"
                      onClick={() => toggleSort('openLotCount')}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberSummaries.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.isActive ? 'Active member' : 'Inactive member'}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(member.lastActivityAt)}</TableCell>
                    <TableCell>{formatNumber(member.netUnits, 6)}</TableCell>
                    <TableCell>{(member.ownershipPct * 100).toFixed(2)}%</TableCell>
                    <TableCell>{formatCurrency(member.totalInvested)}</TableCell>
                    <TableCell>{formatCurrency(member.totalReturned)}</TableCell>
                    <TableCell>{formatCurrency(member.remainingCostBasis)}</TableCell>
                    <TableCell>{formatCurrency(member.currentValue)}</TableCell>
                    <TableCell className={member.realizedReturn >= 0 ? 'text-gain' : 'text-loss'}>
                      {formatCurrency(member.realizedReturn)}
                    </TableCell>
                    <TableCell className={member.unrealizedReturn >= 0 ? 'text-gain' : 'text-loss'}>
                      {formatCurrency(member.unrealizedReturn)}
                    </TableCell>
                    <TableCell className={member.totalReturn >= 0 ? 'text-gain' : 'text-loss'}>
                      {formatCurrency(member.totalReturn)}
                    </TableCell>
                    <TableCell>
                      <div>{member.openLotCount}</div>
                      <div className="text-xs text-muted-foreground">
                        Avg {formatCurrency(member.averageCostPerUnit)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-6">
            <div className="panel-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" />
                <h2 className="text-lg font-semibold">Ledger checks</h2>
              </div>
              {ownershipWarnings.length > 0 ? (
                <div className="space-y-3">
                  {ownershipWarnings.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"
                    >
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {member.netUnits < 0
                          ? 'Negative net units detected.'
                          : `${formatNumber(member.unmatchedUnitsClosed, 6)} units were closed without enough open lots.`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No ownership warnings in the current view. FIFO lots reconcile cleanly against the ledger.
                </p>
              )}
            </div>
            <div className="panel-surface p-5">
              <h2 className="text-lg font-semibold">Recent capital events</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest ledger activity included in the current as-of view.
              </p>
              {recentTransactions.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="rounded-xl border border-border/70 bg-card/65 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {memberNameById.get(transaction.member_id) ?? 'Unknown member'}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type}
                            {transaction.counterparty_member_id
                              ? ` with ${getTransferCounterpartyName(transaction, memberNameById)}`
                              : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-foreground">{formatCurrency(transaction.amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(transaction.units_amount, 6)} units
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(transaction.date)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No transactions fall inside the selected as-of window.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
