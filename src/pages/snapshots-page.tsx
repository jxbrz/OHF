import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ActivitySquare } from 'lucide-react'
import { ChartTimeframeToggle } from '@/components/shared/chart-timeframe-toggle'
import { EmptyState } from '@/components/shared/empty-state'
import { MetricCard } from '@/components/shared/metric-card'
import { PageHeader } from '@/components/shared/page-header'
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
  formatDateTime,
  formatNumber,
  formatUnitPrice,
} from '@/lib/formatters'

export function SnapshotsPage() {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('week')
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={ActivitySquare}
        title="Unable to load snapshot history"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown snapshot error.'}
      />
    )
  }

  const data = clubQuery.data
  const timeframeSeries = data ? getTimeframedSnapshotSeries(data.snapshotSeries, timeframe) : null
  const timeframePerformance = data ? getTimeframeChangeSummary(data.snapshotSeries, timeframe) : null
  const timeframeTicks = timeframeSeries
    ? getTimeframeTicks(timeframeSeries.rangeStartMs, timeframeSeries.rangeEndMs, timeframe)
    : []
  const currencyTooltipFormatter = (value: unknown) =>
    formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0))
  const unitPriceTooltipFormatter = (value: unknown) =>
    formatUnitPrice(Number(Array.isArray(value) ? value[0] : value ?? 0))
  const accountValueAxis = data
    ? getEvenNumericAxis(
        timeframeSeries?.points.map((point) => point.totalAccountValue) ?? [],
        {
          paddingRatio: 0.14,
          minimumPadding: 5,
        }
      )
    : { domain: [0, 1] as const, ticks: [0, 0.25, 0.5, 0.75, 1], fractionDigits: 2 }
  const unitPriceAxis = data
    ? getEvenNumericAxis(
        timeframeSeries?.points.map((point) => point.unitPrice) ?? [],
        {
          paddingRatio: 0.18,
          minimumPadding: 0.005,
        }
      )
    : { domain: [0, 1] as const, ticks: [0, 0.25, 0.5, 0.75, 1], fractionDigits: 2 }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance & snapshots"
        description="Historical portfolio and unit-price snapshots captured by the backend sync flow. Performance is measured from the configured tracking baseline, not the original November starting capital."
        actions={<ChartTimeframeToggle value={timeframe} onChange={setTimeframe} />}
      />
      {!data || data.snapshotSeries.length === 0 ? (
        <EmptyState
          icon={ActivitySquare}
          title="No performance history yet"
          description="Capture the first snapshot from the admin page to start building the performance timeline."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Tracking baseline"
              value={
                data.dashboardSummary.performanceBaselineCapturedAt
                  ? formatDateTime(data.dashboardSummary.performanceBaselineCapturedAt)
                  : 'Not set'
              }
              secondary="First snapshot on or after the configured baseline date"
            />
            <MetricCard
              label="Baseline unit price"
              value={
                data.dashboardSummary.performanceBaselineUnitPrice !== null
                  ? formatUnitPrice(data.dashboardSummary.performanceBaselineUnitPrice)
                  : 'Not set'
              }
              secondary="Used for reported performance"
            />
            <MetricCard
              label={`${TIMEFRAME_WINDOWS[timeframe].label} performance`}
              tone={
                timeframePerformance
                  ? timeframePerformance.changeAmount >= 0
                    ? 'positive'
                    : 'negative'
                  : 'neutral'
              }
              value={
                timeframePerformance
                  ? formatUnitPrice(timeframePerformance.changeAmount)
                  : 'Not enough history'
              }
              secondary={
                timeframePerformance
                  ? `${(timeframePerformance.changePct * 100).toFixed(2)}% ${TIMEFRAME_WINDOWS[timeframe].changeLabel}, measured by unit price`
                  : 'Waiting for enough snapshots'
              }
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="panel-surface p-5">
              <div className="mb-5 space-y-1">
                <h2 className="text-lg font-semibold">Account value</h2>
                <p className="text-sm text-muted-foreground">Total account value across each captured snapshot.</p>
              </div>
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={timeframeSeries?.points ?? []}>
                    <XAxis
                      type="number"
                      dataKey="capturedAtMs"
                      scale="time"
                      domain={
                        timeframeSeries
                          ? [timeframeSeries.rangeStartMs, timeframeSeries.rangeEndMs]
                          : ['auto', 'auto']
                      }
                      ticks={timeframeTicks}
                      tickFormatter={(value) => formatTimeframeTick(Number(value), timeframe)}
                      tickMargin={10}
                      minTickGap={24}
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={accountValueAxis.domain}
                      ticks={accountValueAxis.ticks}
                      tickFormatter={(value) => formatCurrencyAxis(Number(value), 'GBP', 0)}
                      width={72}
                      tickMargin={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={currencyTooltipFormatter}
                      labelFormatter={(value) => formatDateTime(new Date(Number(value)).toISOString())}
                    />
                    <Line dataKey="totalAccountValue" stroke="#30c59b" strokeWidth={2.4} dot={false} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel-surface p-5">
              <div className="mb-5 space-y-1">
                <h2 className="text-lg font-semibold">Unit price</h2>
                <p className="text-sm text-muted-foreground">Unit-price performance across the same snapshot timeline.</p>
              </div>
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={timeframeSeries?.points ?? []}>
                    <XAxis
                      type="number"
                      dataKey="capturedAtMs"
                      scale="time"
                      domain={
                        timeframeSeries
                          ? [timeframeSeries.rangeStartMs, timeframeSeries.rangeEndMs]
                          : ['auto', 'auto']
                      }
                      ticks={timeframeTicks}
                      tickFormatter={(value) => formatTimeframeTick(Number(value), timeframe)}
                      tickMargin={10}
                      minTickGap={24}
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={unitPriceAxis.domain}
                      ticks={unitPriceAxis.ticks}
                      tickFormatter={(value) =>
                        formatCurrencyAxis(
                          Number(value),
                          'GBP',
                          Math.max(unitPriceAxis.fractionDigits, 2)
                        )
                      }
                      width={72}
                      tickMargin={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={unitPriceTooltipFormatter}
                      labelFormatter={(value) => formatDateTime(new Date(Number(value)).toISOString())}
                    />
                    <Line dataKey="unitPrice" stroke="#3a88f7" strokeWidth={2.4} dot={false} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="panel-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Captured at</TableHead>
                  <TableHead>Total account value</TableHead>
                  <TableHead>Available cash</TableHead>
                  <TableHead>Unrealized P&amp;L</TableHead>
                  <TableHead>Realized P&amp;L</TableHead>
                  <TableHead>Total units</TableHead>
                  <TableHead>Unit price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>{formatDateTime(snapshot.captured_at)}</TableCell>
                    <TableCell>{formatCurrency(snapshot.total_account_value)}</TableCell>
                    <TableCell>{formatCurrency(snapshot.available_cash ?? 0)}</TableCell>
                    <TableCell>{formatCurrency(snapshot.unrealized_pnl ?? 0)}</TableCell>
                    <TableCell>{formatCurrency(snapshot.realized_pnl ?? 0)}</TableCell>
                    <TableCell>{formatNumber(snapshot.total_units, 6)}</TableCell>
                    <TableCell>{formatUnitPrice(snapshot.unit_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
