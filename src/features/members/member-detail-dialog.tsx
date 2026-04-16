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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PnlValue } from '@/components/shared/pnl-value'
import { formatCurrency, formatCurrencyAxis, formatDateTime, formatNumber } from '@/lib/formatters'
import { getTransferCounterpartyName } from '@/lib/transfers'
import type { FundTransactionRecord, MemberSummaryRow } from '@/types/app'
import type { Tables } from '@/types/database'

interface MemberDetailDialogProps {
  member: MemberSummaryRow | null
  members: Tables<'members'>[]
  transactions: FundTransactionRecord[]
  snapshots: Tables<'portfolio_snapshots'>[]
  fundCurrency: 'GBP' | 'USD'
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getChartDomain(values: number[]) {
  const numericValues = values.filter((value) => Number.isFinite(value))

  if (numericValues.length === 0) {
    return [0, 1] as const
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const range = maxValue - minValue
  const padding = Math.max(range * 0.16, 2)

  if (range === 0) {
    return [minValue - padding, maxValue + padding] as const
  }

  return [minValue - padding, maxValue + padding] as const
}

export function MemberDetailDialog({
  member,
  members,
  transactions,
  snapshots,
  fundCurrency,
  open,
  onOpenChange,
}: MemberDetailDialogProps) {
  const memberNameById = new Map(members.map((entry) => [entry.id, entry.name]))
  const memberTransactions = member
    ? transactions.filter((transaction) => transaction.member_id === member.id)
    : []
  const memberHistory = member
    ? buildMemberHistorySeries({
        memberId: member.id,
        transactions: [...transactions].sort(
          (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
        ),
        snapshots,
      })
    : []
  const equityCurveDomain = getChartDomain(memberHistory.map((point) => point.currentValue))
  const firstHistoryPoint = memberHistory[0] ?? null
  const latestHistoryPoint = memberHistory.at(-1) ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl bg-card">
        <DialogHeader>
          <DialogTitle>{member?.name ?? 'Member details'}</DialogTitle>
          <DialogDescription>
            A full member profile with ownership, cash-flow breakdown, equity history, and transaction ledger.
          </DialogDescription>
        </DialogHeader>
        {member ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Net units</div>
                <div className="mt-2 text-xl font-semibold">{formatNumber(member.netUnits, 6)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ownership</div>
                <div className="mt-2 text-xl font-semibold">{(member.ownershipPct * 100).toFixed(2)}%</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current value</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.currentValue)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total return</div>
                <div className="mt-2 text-xl font-semibold">
                  <PnlValue value={member.totalReturn} />
                </div>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
              <div className="rounded-2xl border border-border/70 bg-secondary/25 p-5">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Equity curve</h3>
                  <p className="text-sm text-muted-foreground">
                    Value of this member's holdings at each stored snapshot, based on the units they held at that time.
                  </p>
                </div>
                {memberHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-background/15 px-4 py-8 text-sm text-muted-foreground">
                    No snapshot history is available for this member yet.
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <AreaChart data={memberHistory}>
                        <defs>
                          <linearGradient id="member-equity-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="rgba(94, 171, 255, 0.38)" />
                            <stop offset="100%" stopColor="rgba(94, 171, 255, 0.05)" />
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
                          domain={equityCurveDomain}
                          tickFormatter={(value) => formatCurrencyAxis(Number(value), fundCurrency, 0)}
                          tickLine={false}
                          axisLine={false}
                          width={72}
                        />
                        <Tooltip
                          formatter={(value: unknown) =>
                            formatCurrency(
                              Number(Array.isArray(value) ? value[0] : value ?? 0),
                              fundCurrency
                            )
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
                          strokeWidth={2.4}
                          fill="url(#member-equity-fill)"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="grid gap-3">
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current units</div>
                  <div className="mt-2 text-xl font-semibold">{formatNumber(member.netUnits, 6)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Snapshots tracked</div>
                  <div className="mt-2 text-xl font-semibold">{memberHistory.length}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Transaction count</div>
                  <div className="mt-2 text-xl font-semibold">{memberTransactions.length}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">First tracked value</div>
                  <div className="mt-2 text-xl font-semibold">
                    {firstHistoryPoint ? formatCurrency(firstHistoryPoint.currentValue, fundCurrency) : 'N/A'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {firstHistoryPoint ? formatDateTime(firstHistoryPoint.capturedAt) : 'No snapshot yet'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest tracked value</div>
                  <div className="mt-2 text-xl font-semibold">
                    {latestHistoryPoint ? formatCurrency(latestHistoryPoint.currentValue, fundCurrency) : 'N/A'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {latestHistoryPoint ? formatDateTime(latestHistoryPoint.capturedAt) : 'No snapshot yet'}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4 text-sm text-muted-foreground">
              Fund cash and private trades are different things. Deposits and withdrawals move money
              into or out of the club. Member-to-member purchases do not change club NAV, but they do
              change the buyer's cost basis and the seller's realized return.
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deposited to fund</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.fundDeposits)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Withdrawn from fund</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.fundWithdrawals)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bought from members</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.secondaryPurchaseCost)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sold to members</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.secondarySaleProceeds)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Remaining cost basis</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.remainingCostBasis)}</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Realized return</div>
                <div className="mt-2 text-xl font-semibold">
                  <PnlValue value={member.realizedReturn} />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Unrealized return</div>
                <div className="mt-2 text-xl font-semibold">
                  <PnlValue value={member.unrealizedReturn} />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Average cost per unit</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.averageCostPerUnit)}</div>
              </div>
            </div>
            <div className="panel-surface overflow-hidden">
              <div className="border-b border-border/70 px-4 py-3">
                <h3 className="font-semibold text-foreground">Transaction history</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every ledger event recorded for this member, including private transfers and fund cashflows.
                </p>
              </div>
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
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {transaction.notes ?? 'No notes'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
