import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ActivitySquare, ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PnlValue } from '@/components/shared/pnl-value'
import { fetchClubData } from '@/lib/api'
import {
  formatCurrency,
  formatCurrencyAxis,
  formatDateTime,
  formatSignedCurrency,
  formatNumber,
} from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { SnapshotChartPoint } from '@/types/app'

function getChartDomain(values: number[]) {
  const numericValues = values.filter((value) => Number.isFinite(value))

  if (numericValues.length === 0) {
    return [0, 1] as const
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const range = maxValue - minValue
  const padding = Math.max(range * 0.16, 4)

  if (range === 0) {
    return [minValue - padding, maxValue + padding] as const
  }

  return [minValue - padding, maxValue + padding] as const
}

function getWeeklyPerformance(series: SnapshotChartPoint[]) {
  if (series.length === 0) {
    return null
  }

  const sortedSeries = [...series].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
  )
  const latestPoint = sortedSeries.at(-1)

  if (!latestPoint) {
    return null
  }

  const latestTimestamp = new Date(latestPoint.capturedAt).getTime()
  const weekAgoTimestamp = latestTimestamp - 7 * 24 * 60 * 60 * 1000
  const baselinePoint =
    [...sortedSeries]
      .reverse()
      .find((point) => new Date(point.capturedAt).getTime() <= weekAgoTimestamp) ??
    sortedSeries[0]

  const changeAmount = latestPoint.totalAccountValue - baselinePoint.totalAccountValue
  const changePct =
    baselinePoint.totalAccountValue > 0 ? changeAmount / baselinePoint.totalAccountValue : 0

  return {
    changeAmount,
    changePct,
    baselineAt: baselinePoint.capturedAt,
    latestAt: latestPoint.capturedAt,
  }
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <section className="panel-surface flex min-h-[52vh] items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl animate-pulse space-y-4 text-center">
          <div className="mx-auto h-4 w-24 rounded-full bg-secondary/70" />
          <div className="mx-auto h-16 w-72 max-w-full rounded-3xl bg-secondary/60" />
          <div className="mx-auto h-6 w-40 rounded-full bg-secondary/60" />
          <div className="mx-auto h-3.5 w-48 max-w-full rounded-full bg-secondary/50" />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
        <div className="panel-surface h-[24rem] animate-pulse bg-secondary/20" />
        <div className="panel-surface h-[24rem] animate-pulse bg-secondary/20" />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isPending) {
    return <OverviewSkeleton />
  }

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={ActivitySquare}
        title="Unable to load the overview"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown overview error.'}
      />
    )
  }

  const data = clubQuery.data

  if (!data) {
    return (
      <EmptyState
        icon={Wallet}
        title="Overview is not available yet"
        description="Connect the broker sync or capture a manual snapshot to bring the front page to life."
      />
    )
  }

  const fundCurrency = data.fundCurrency === 'USD' ? 'USD' : 'GBP'
  const brokerCurrency = data.brokerCurrency === 'GBP' ? 'GBP' : 'USD'
  const weeklyPerformance = getWeeklyPerformance(data.snapshotSeries)
  const latestSnapshotAt = data.latestSnapshot?.captured_at ?? weeklyPerformance?.latestAt ?? null
  const accountValueDomain = getChartDomain(
    data.snapshotSeries.map((point) => point.totalAccountValue)
  )
  const accountValueTooltipFormatter = (value: unknown) =>
    formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0), fundCurrency)

  return (
    <div className="space-y-8 pb-4">
      <section className="panel-surface relative flex min-h-[52vh] items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,155,235,0.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(49,167,154,0.12),transparent_34%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative z-10 max-w-3xl text-center">
          <p className="mb-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Account value
          </p>
          <div className="font-mono text-[3.4rem] font-semibold tracking-tight text-foreground sm:text-[4.9rem] lg:text-[6rem]">
            {formatCurrency(data.dashboardSummary.totalAccountValue, fundCurrency)}
          </div>
          <div className="mt-4 flex items-center justify-center">
            {weeklyPerformance ? (
              <p
                className={cn(
                  'inline-flex items-center gap-2 text-sm',
                  weeklyPerformance.changeAmount > 0
                    ? 'text-gain'
                    : weeklyPerformance.changeAmount < 0
                      ? 'text-loss'
                      : 'text-muted-foreground'
                )}
              >
                {weeklyPerformance.changeAmount > 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : weeklyPerformance.changeAmount < 0 ? (
                  <ArrowDownRight className="size-3.5" />
                ) : (
                  <ActivitySquare className="size-3.5" />
                )}
                <span>{formatSignedCurrency(weeklyPerformance.changeAmount, fundCurrency)} this week</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for enough history to show weekly movement
              </p>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {latestSnapshotAt ? `Last sync ${formatDateTime(latestSnapshotAt)}` : 'No snapshot yet'}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
        <section className="panel-surface p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Equity curve</h2>
          </div>
          {data.snapshotSeries.length === 0 ? (
            <EmptyState
              icon={ActivitySquare}
              title="No curve yet"
              description="Capture a few snapshots and this page will start telling the story properly."
            />
          ) : (
            <div className="h-[26rem]">
              <ResponsiveContainer>
                <AreaChart data={data.snapshotSeries}>
                  <defs>
                    <linearGradient id="overview-equity-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(94, 171, 255, 0.42)" />
                      <stop offset="100%" stopColor="rgba(94, 171, 255, 0.04)" />
                    </linearGradient>
                  </defs>
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
                  <CartesianGrid vertical={false} stroke="rgba(137, 176, 214, 0.08)" />
                  <YAxis
                    domain={accountValueDomain}
                    tickFormatter={(value) => formatCurrencyAxis(Number(value), fundCurrency, 0)}
                    width={78}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={accountValueTooltipFormatter}
                    labelFormatter={(value) => formatDateTime(String(value))}
                    contentStyle={{
                      background: 'rgba(20, 28, 45, 0.96)',
                      border: '1px solid rgba(137, 176, 214, 0.18)',
                      borderRadius: '16px',
                    }}
                  />
                  <Area
                    dataKey="totalAccountValue"
                    type="monotone"
                    stroke="#5b9beb"
                    strokeWidth={2.5}
                    fill="url(#overview-equity-fill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="panel-surface p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Current trades</h2>
          </div>
          {data.holdingsRows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No positions yet"
              description="Run the broker sync to pull the current holdings into the app."
            />
          ) : (
            <div className="space-y-1">
              {data.holdingsRows.map((holding) => (
                <article
                  key={holding.id}
                  className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{holding.symbol}</p>
                    <p className="truncate text-sm text-muted-foreground">{holding.instrumentName}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(holding.marketValue, fundCurrency)}
                    </div>
                    <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                      <span>{formatNumber(holding.quantity, 2)} @ {formatCurrency(holding.currentPrice, brokerCurrency)}</span>
                      <PnlValue value={holding.pnl} className="font-medium" currency={fundCurrency} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
