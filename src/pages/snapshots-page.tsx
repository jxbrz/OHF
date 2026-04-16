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
import { formatCurrency, formatCurrencyAxis, formatDateTime, formatNumber } from '@/lib/formatters'

function getChartDomain(
  values: number[],
  options?: {
    paddingRatio?: number
    minimumPadding?: number
  }
) {
  const numericValues = values.filter((value) => Number.isFinite(value))

  if (numericValues.length === 0) {
    return [0, 1] as const
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const range = maxValue - minValue
  const padding = Math.max(
    range * (options?.paddingRatio ?? 0.12),
    options?.minimumPadding ?? 1
  )

  if (range === 0) {
    return [minValue - padding, maxValue + padding] as const
  }

  return [minValue - padding, maxValue + padding] as const
}

export function SnapshotsPage() {
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
  const currencyTooltipFormatter = (value: unknown) =>
    formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0))
  const accountValueDomain = data
    ? getChartDomain(
        data.snapshotSeries.map((point) => point.totalAccountValue),
        {
          paddingRatio: 0.14,
          minimumPadding: 5,
        }
      )
    : [0, 1]
  const unitPriceDomain = data
    ? getChartDomain(
        data.snapshotSeries.map((point) => point.unitPrice),
        {
          paddingRatio: 0.18,
          minimumPadding: 0.005,
        }
      )
    : [0, 1]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance & snapshots"
        description="Historical portfolio and unit-price snapshots captured by the backend sync flow. Performance is measured from the configured tracking baseline, not the original November starting capital."
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
                  ? formatCurrency(data.dashboardSummary.performanceBaselineUnitPrice)
                  : 'Not set'
              }
              secondary="Used for reported performance"
            />
            <MetricCard
              label="Performance since baseline"
              tone={data.dashboardSummary.overallPerformancePct >= 0 ? 'positive' : 'negative'}
              value={`${(data.dashboardSummary.overallPerformancePct * 100).toFixed(2)}%`}
              secondary={`Current unit price ${formatCurrency(data.dashboardSummary.currentUnitPrice)}`}
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
                  <LineChart data={data.snapshotSeries}>
                    <XAxis
                      dataKey="capturedAt"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-GB', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis
                      domain={accountValueDomain}
                      tickFormatter={(value) => formatCurrencyAxis(Number(value), 'GBP', 0)}
                      width={72}
                    />
                    <Tooltip formatter={currencyTooltipFormatter} labelFormatter={(value) => formatDateTime(String(value))} />
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
                  <LineChart data={data.snapshotSeries}>
                    <XAxis
                      dataKey="capturedAt"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-GB', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis
                      domain={unitPriceDomain}
                      tickFormatter={(value) => formatCurrencyAxis(Number(value), 'GBP', 2)}
                      width={72}
                    />
                    <Tooltip formatter={currencyTooltipFormatter} labelFormatter={(value) => formatDateTime(String(value))} />
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
                    <TableCell>{formatCurrency(snapshot.unit_price)}</TableCell>
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
