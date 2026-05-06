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
import { PnlValue } from '@/components/shared/pnl-value'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import {
  formatCurrency,
  formatCurrencyAxis,
  formatDateTime,
  formatNumber,
} from '@/lib/formatters'
import { getTransferCounterpartyName } from '@/lib/transfers'
import type { FundTransactionRecord, MemberSummaryRow, PortfolioSnapshotLike } from '@/types/app'
import type { Tables } from '@/types/database'

interface MemberDetailDrawerProps {
  member: MemberSummaryRow | null
  members: Tables<'members'>[]
  transactions: FundTransactionRecord[]
  snapshots: PortfolioSnapshotLike[]
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

export function MemberDetailDrawer({
  member,
  members,
  transactions,
  snapshots,
  fundCurrency,
  open,
  onOpenChange,
}: MemberDetailDrawerProps) {
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
  const trackedChangeAmount =
    firstHistoryPoint && latestHistoryPoint
      ? latestHistoryPoint.currentValue - firstHistoryPoint.currentValue
      : null
  const trackedChangePct =
    trackedChangeAmount !== null && firstHistoryPoint && firstHistoryPoint.currentValue > 0
      ? trackedChangeAmount / firstHistoryPoint.currentValue
      : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="drawer"
        className="overflow-hidden border-border/70 bg-card/98 p-0"
      >
        {member ? (
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader className="gap-4 border-b border-border/70 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <SheetTitle className="text-2xl">{member.name}</SheetTitle>
                  <SheetDescription>
                    Ownership profile, private trade activity, and personal ledger history.
                  </SheetDescription>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3 text-left lg:min-w-64 lg:text-right">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current value</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">
                    {formatCurrency(member.currentValue, fundCurrency)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatNumber(member.netUnits, 6)} units
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ownership</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">
                    {(member.ownershipPct * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total return</div>
                  <div className="mt-2 text-lg font-semibold">
                    <PnlValue value={member.totalReturn} currency={fundCurrency} />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Transactions</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{memberTransactions.length}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Last activity</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {member.lastActivityAt ? formatDateTime(member.lastActivityAt) : 'No activity'}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Tabs className="flex min-h-0 flex-1 flex-col" defaultValue="overview">
              <div className="border-b border-border/70 px-6 py-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                <TabsContent className="space-y-5 pt-5" value="overview">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/70 bg-secondary/25 p-5">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-foreground">Equity curve</h3>
                        <p className="text-sm text-muted-foreground">
                          Member value at each stored snapshot, based on the units held at that time.
                        </p>
                      </div>
                      {memberHistory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/15 px-4 py-10 text-sm text-muted-foreground">
                          No snapshot history is available for this member yet.
                        </div>
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer>
                            <AreaChart data={memberHistory}>
                              <defs>
                                <linearGradient id="member-equity-fill" x1="0" x2="0" y1="0" y2="1">
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
                                strokeWidth={2.3}
                                fill="url(#member-equity-fill)"
                                dot={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tracked performance</div>
                        <div className="mt-2 text-lg font-semibold">
                          {trackedChangeAmount !== null ? (
                            <PnlValue value={trackedChangeAmount} currency={fundCurrency} />
                          ) : (
                            'N/A'
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {trackedChangePct !== null
                            ? `${(trackedChangePct * 100).toFixed(2)}% since first tracked snapshot`
                            : 'Needs at least one tracked snapshot'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">First tracked value</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">
                          {firstHistoryPoint
                            ? formatCurrency(firstHistoryPoint.currentValue, fundCurrency)
                            : 'N/A'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {firstHistoryPoint ? formatDateTime(firstHistoryPoint.capturedAt) : 'No snapshot yet'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest tracked value</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">
                          {latestHistoryPoint
                            ? formatCurrency(latestHistoryPoint.currentValue, fundCurrency)
                            : 'N/A'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {latestHistoryPoint ? formatDateTime(latestHistoryPoint.capturedAt) : 'No snapshot yet'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Snapshots tracked</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">{memberHistory.length}</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent className="space-y-5 pt-5" value="activity">
                  <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4 text-sm text-muted-foreground">
                    Fund cash and private trades are different things. Deposits and withdrawals move money
                    into or out of the club. Member-to-member purchases do not change club NAV, but they do
                    change the buyer&apos;s cost basis and the seller&apos;s realized return.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deposited to fund</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {formatCurrency(member.fundDeposits, fundCurrency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Withdrawn from fund</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {formatCurrency(member.fundWithdrawals, fundCurrency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bought from members</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {formatCurrency(member.secondaryPurchaseCost, fundCurrency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sold to members</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {formatCurrency(member.secondarySaleProceeds, fundCurrency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Remaining cost basis</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {formatCurrency(member.remainingCostBasis, fundCurrency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Average cost / unit</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {formatCurrency(member.averageCostPerUnit, fundCurrency)}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Realized return</div>
                      <div className="mt-2 text-lg font-semibold">
                        <PnlValue value={member.realizedReturn} currency={fundCurrency} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Unrealized return</div>
                      <div className="mt-2 text-lg font-semibold">
                        <PnlValue value={member.unrealizedReturn} currency={fundCurrency} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total return</div>
                      <div className="mt-2 text-lg font-semibold">
                        <PnlValue value={member.totalReturn} currency={fundCurrency} />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent className="space-y-5 pt-5" value="history">
                  {memberTransactions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-secondary/15 px-4 py-10 text-sm text-muted-foreground">
                      No ledger entries have been recorded for this member yet.
                    </div>
                  ) : (
                    <div className="panel-surface overflow-hidden">
                      <div className="border-b border-border/70 px-4 py-3">
                        <h3 className="font-semibold text-foreground">Transaction history</h3>
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
                                <TableCell className="text-right">
                                  {formatCurrency(transaction.amount, fundCurrency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(transaction.unit_price_at_time, 6)}
                                </TableCell>
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
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
