import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildMemberHistorySeries } from '@shared/calculations'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, History, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { PnlValue } from '@/components/shared/pnl-value'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchClubData } from '@/lib/api'
import { getEvenNumericAxis } from '@/lib/chart-axes'
import { TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import {
  formatCurrency,
  formatCurrencyAxis,
  formatDateTime,
  formatNumber,
} from '@/lib/formatters'
import { getTransferCounterpartyName } from '@/lib/transfers'

export function MemberProfilePage() {
  const { memberId } = useParams<{ memberId: string }>()
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={Users}
        title="Unable to load member profile"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown member error.'}
      />
    )
  }

  if (!clubQuery.data) {
    return null
  }

  const data = clubQuery.data
  const fundCurrency = data.fundCurrency === 'USD' ? 'USD' : 'GBP'
  const membersInOrder = [...data.memberSummaries].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
  const member = membersInOrder.find((entry) => entry.id === memberId)

  if (!member) {
    return (
      <EmptyState
        icon={Users}
        title="Member not found"
        description="That member profile could not be found in the current ledger."
      />
    )
  }

  const memberIndex = membersInOrder.findIndex((entry) => entry.id === member.id)
  const previousMember = memberIndex > 0 ? membersInOrder[memberIndex - 1] : null
  const nextMember = memberIndex < membersInOrder.length - 1 ? membersInOrder[memberIndex + 1] : null
  const memberNameById = new Map(data.members.map((entry) => [entry.id, entry.name]))
  const memberTransactions = data.transactions
    .filter((transaction) => transaction.member_id === member.id)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
  const memberHistory = buildMemberHistorySeries({
    memberId: member.id,
    transactions: [...data.transactions].sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    ),
    snapshots: data.snapshots,
  })
  const chartAxis = getEvenNumericAxis(
    memberHistory.map((point) => point.currentValue),
    {
      paddingRatio: 0.16,
      minimumPadding: 2,
    }
  )
  const recentTransactions = memberTransactions.slice(0, 4)

  return (
    <div className="space-y-8">
      <PageHeader
        title={member.name}
        description="Ownership profile, private trade activity, performance history, and full member ledger."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/members">
                <ArrowLeft className="size-4" />
                Back to members
              </Link>
            </Button>
            {previousMember ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/members/${previousMember.id}`}>{previousMember.name}</Link>
              </Button>
            ) : null}
            {nextMember ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/members/${nextMember.id}`}>
                  {nextMember.name}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr]">
        <div className="panel-surface p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current value</div>
          <div className="mt-3 text-5xl font-semibold text-foreground">
            {formatCurrency(member.currentValue, fundCurrency)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>{formatNumber(member.netUnits, 6)} units held</span>
            <span>{(member.ownershipPct * 100).toFixed(2)}% ownership</span>
          </div>
        </div>
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total return</div>
          <div className="mt-2 text-2xl font-semibold">
            <PnlValue value={member.totalReturn} currency={fundCurrency} />
          </div>
        </div>
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Remaining cost basis</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(member.remainingCostBasis, fundCurrency)}
          </div>
        </div>
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Last activity</div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {member.lastActivityAt ? formatDateTime(member.lastActivityAt) : 'No activity'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="panel-surface p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Equity curve</h2>
            <p className="text-sm text-muted-foreground">
              Member value at each stored snapshot, based on the units held at that time.
            </p>
          </div>
          {memberHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-secondary/15 px-4 py-10 text-sm text-muted-foreground">
              No snapshot history is available for this member yet.
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer>
                <AreaChart data={memberHistory}>
                  <defs>
                    <linearGradient id="member-profile-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(94, 171, 255, 0.36)" />
                      <stop offset="100%" stopColor="rgba(94, 171, 255, 0.04)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(137, 176, 214, 0.08)" />
                  <XAxis
                    dataKey="capturedAt"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis
                    domain={chartAxis.domain}
                    ticks={chartAxis.ticks}
                    tickFormatter={(value) => formatCurrencyAxis(Number(value), fundCurrency, 0)}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickMargin={10}
                  />
                  <Tooltip
                    formatter={(value: unknown) =>
                      formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0), fundCurrency)
                    }
                    labelFormatter={(value) => formatDateTime(String(value))}
                    contentStyle={{
                      background: 'rgba(20, 28, 45, 0.96)',
                      border: '1px solid rgba(137, 176, 214, 0.18)',
                      borderRadius: '16px',
                    }}
                  />
                  <Area
                    dataKey="currentValue"
                    type="monotone"
                    stroke="#5b9beb"
                    strokeWidth={2.3}
                    fill="url(#member-profile-fill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel-surface p-5">
            <div className="mb-3 flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recorded member activity yet.</div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-xl border border-border/70 bg-secondary/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-foreground">
                          {TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(transaction.date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">
                          {formatCurrency(transaction.amount, fundCurrency)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(transaction.units_amount, 6)} units
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {getTransferCounterpartyName(transaction, memberNameById)
                        ? `Counterparty: ${getTransferCounterpartyName(transaction, memberNameById)}`
                        : transaction.notes ?? 'No notes'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="panel-surface p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deposited to fund</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(member.fundDeposits, fundCurrency)}
              </div>
            </div>
            <div className="panel-surface p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bought from members</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(member.secondaryPurchaseCost, fundCurrency)}
              </div>
            </div>
            <div className="panel-surface p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Realized return</div>
              <div className="mt-2 text-2xl font-semibold">
                <PnlValue value={member.realizedReturn} currency={fundCurrency} />
              </div>
            </div>
            <div className="panel-surface p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Unrealized return</div>
              <div className="mt-2 text-2xl font-semibold">
                <PnlValue value={member.unrealizedReturn} currency={fundCurrency} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-surface overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="font-semibold text-foreground">Full member ledger</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every ledger event recorded for this member, including private transfers and fund cashflows.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDateTime(transaction.date)}</TableCell>
                  <TableCell>{TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type}</TableCell>
                  <TableCell>{getTransferCounterpartyName(transaction, memberNameById) ?? 'None'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(transaction.amount, fundCurrency)}</TableCell>
                  <TableCell className="text-right">{formatNumber(transaction.unit_price_at_time, 6)}</TableCell>
                  <TableCell className="text-right">{formatNumber(transaction.units_amount, 6)}</TableCell>
                  <TableCell className="max-w-52 truncate text-muted-foreground">
                    {transaction.notes ?? 'No notes'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
