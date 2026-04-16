import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ActivitySquare, ArrowDownRight, ArrowUpRight, BookText, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChartTimeframeToggle } from '@/components/shared/chart-timeframe-toggle'
import { EmptyState } from '@/components/shared/empty-state'
import { PnlValue } from '@/components/shared/pnl-value'
import { fetchClubData } from '@/lib/api'
import { getEvenNumericAxis } from '@/lib/chart-axes'
import {
  formatTimeframeTick,
  getTimeframeTicks,
  getTimeframeChangeSummary,
  getTimeframedSnapshotSeries,
  TIMEFRAME_WINDOWS,
  type ChartTimeframe,
} from '@/lib/chart-timeframes'
import {
  formatCurrency,
  formatCurrencyAxis,
  formatDate,
  formatDateTime,
  formatSignedUnitPrice,
  formatNumber,
} from '@/lib/formatters'
import { cn } from '@/lib/utils'

function extractReviewNarrative(rawJson: unknown) {
  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    typeof (rawJson as { dailyNarrative?: unknown }).dailyNarrative === 'string'
  ) {
    return ((rawJson as { dailyNarrative: string }).dailyNarrative || '').trim()
  }

  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    Array.isArray((rawJson as { bulletPoints?: unknown[] }).bulletPoints)
  ) {
    return (rawJson as { bulletPoints: unknown[] }).bulletPoints
      .filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
      )
      .join(' ')
  }

  return ''
}

function extractReviewOutlook(rawJson: unknown) {
  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    typeof (rawJson as { outlookNarrative?: unknown }).outlookNarrative === 'string'
  ) {
    return ((rawJson as { outlookNarrative: string }).outlookNarrative || '').trim()
  }

  if (
    rawJson &&
    typeof rawJson === 'object' &&
    !Array.isArray(rawJson) &&
    Array.isArray((rawJson as { outlookPoints?: unknown[] }).outlookPoints)
  ) {
    return (rawJson as { outlookPoints: unknown[] }).outlookPoints
      .filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
      )
      .join(' ')
  }

  return ''
}

function extractReviewMeta(rawJson: unknown) {
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
    return { scheduled: false, usedFallback: false }
  }

  return {
    scheduled: (rawJson as { scheduled?: unknown }).scheduled === true,
    usedFallback: typeof (rawJson as { openAiError?: unknown }).openAiError === 'string',
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
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('week')
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
  const timeframeSeries = getTimeframedSnapshotSeries(data.snapshotSeries, timeframe)
  const timeframePerformance = getTimeframeChangeSummary(data.snapshotSeries, timeframe)
  const latestSnapshotAt = data.latestSnapshot?.captured_at ?? timeframePerformance?.latestAt ?? null
  const accountValueAxis = getEvenNumericAxis(
    timeframeSeries.points.map((point) => point.totalAccountValue),
    {
      paddingRatio: 0.16,
      minimumPadding: 4,
    }
  )
  const timeframeTicks = getTimeframeTicks(
    timeframeSeries.rangeStartMs,
    timeframeSeries.rangeEndMs,
    timeframe
  )
  const accountValueTooltipFormatter = (value: unknown) =>
    formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0), fundCurrency)
  const timeframeLabel = TIMEFRAME_WINDOWS[timeframe].changeLabel

  return (
    <div className="space-y-8 pb-4">
      <section className="panel-surface relative flex min-h-[52vh] items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,155,235,0.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(49,167,154,0.12),transparent_34%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative z-10 max-w-3xl text-center">
          <div className="mb-5 flex justify-center">
            <ChartTimeframeToggle value={timeframe} onChange={setTimeframe} />
          </div>
          <p className="mb-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Account value
          </p>
          <div className="font-mono text-[3.4rem] font-semibold tracking-tight text-foreground sm:text-[4.9rem] lg:text-[6rem]">
            {formatCurrency(data.dashboardSummary.totalAccountValue, fundCurrency)}
          </div>
          <div className="mt-4 flex items-center justify-center">
            {timeframePerformance ? (
              <p
                className={cn(
                  'inline-flex items-center gap-2 text-sm',
                  timeframePerformance.changeAmount > 0
                    ? 'text-gain'
                    : timeframePerformance.changeAmount < 0
                      ? 'text-loss'
                      : 'text-muted-foreground'
                )}
              >
                {timeframePerformance.changeAmount > 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : timeframePerformance.changeAmount < 0 ? (
                  <ArrowDownRight className="size-3.5" />
                ) : (
                  <ActivitySquare className="size-3.5" />
                )}
                <span>
                  Unit price {formatSignedUnitPrice(timeframePerformance.changeAmount, fundCurrency)} {timeframeLabel}
                  {' · '}
                  {(timeframePerformance.changePct * 100).toFixed(2)}%
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for enough history to show {timeframeLabel} movement
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
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Equity curve</h2>
            <ChartTimeframeToggle value={timeframe} onChange={setTimeframe} />
          </div>
          {timeframeSeries.points.length === 0 ? (
            <EmptyState
              icon={ActivitySquare}
              title="No curve yet"
              description="Capture a few snapshots and this page will start telling the story properly."
            />
          ) : (
            <div className="h-[26rem]">
              <ResponsiveContainer>
                <AreaChart data={timeframeSeries.points}>
                  <defs>
                    <linearGradient id="overview-equity-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(94, 171, 255, 0.42)" />
                      <stop offset="100%" stopColor="rgba(94, 171, 255, 0.04)" />
                    </linearGradient>
                  </defs>
                  <XAxis
                    type="number"
                    dataKey="capturedAtMs"
                    scale="time"
                    domain={[timeframeSeries.rangeStartMs, timeframeSeries.rangeEndMs]}
                    ticks={timeframeTicks}
                    tickFormatter={(value) => formatTimeframeTick(Number(value), timeframe)}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={24}
                    interval={0}
                    dy={8}
                  />
                  <CartesianGrid vertical={false} stroke="rgba(137, 176, 214, 0.08)" />
                  <YAxis
                    domain={accountValueAxis.domain}
                    ticks={accountValueAxis.ticks}
                    tickFormatter={(value) => formatCurrencyAxis(Number(value), fundCurrency, 0)}
                    width={78}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <Tooltip
                    formatter={accountValueTooltipFormatter}
                    labelFormatter={(value) => formatDateTime(new Date(Number(value)).toISOString())}
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

      <section className="panel-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Latest daily review</h2>
            <p className="text-sm text-muted-foreground">
              A short internal note for the group based on the most recent reviewed trading day.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/reviews">
              <BookText className="size-4" />
              View log
            </Link>
          </Button>
        </div>

        {data.latestDailyReview ? (
          (() => {
            const dailyNarrative = extractReviewNarrative(data.latestDailyReview.raw_json)
            const outlookPoints = extractReviewOutlook(data.latestDailyReview.raw_json)
            const meta = extractReviewMeta(data.latestDailyReview.raw_json)

            return (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_280px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{formatDate(data.latestDailyReview.review_date)}</span>
                    <span className="rounded-full border border-border/70 bg-secondary/20 px-2.5 py-1 normal-case tracking-normal text-foreground">
                      {meta.scheduled ? 'Auto post' : 'Manual post'}
                    </span>
                    <span className="rounded-full border border-border/70 bg-secondary/20 px-2.5 py-1 normal-case tracking-normal text-foreground">
                      {meta.usedFallback ? 'System summary' : 'AI review'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    {data.latestDailyReview.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {data.latestDailyReview.summary}
                  </p>

                  {dailyNarrative ? (
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground">
                      {dailyNarrative}
                    </p>
                  ) : null}

                  {outlookPoints.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/15 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Looking ahead
                      </div>
                      <div className="mt-2 text-sm text-foreground">{outlookPoints[0]}</div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/25 px-4 py-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Generated</div>
                  <div className="mt-2 font-medium text-foreground">
                    {formatDateTime(data.latestDailyReview.generated_at)}
                  </div>
                  {data.latestDailyReview.model ? (
                    <div className="mt-1 text-xs text-muted-foreground">{data.latestDailyReview.model}</div>
                  ) : null}
                </div>
              </div>
            )
          })()
        ) : (
          <EmptyState
            icon={BookText}
            title="No daily review yet"
            description="Generate the first review and it will appear here as a quick note for the group."
          />
        )}
      </section>
    </div>
  )
}
