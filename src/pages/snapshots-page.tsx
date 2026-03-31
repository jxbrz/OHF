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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance & snapshots"
        description="Historical portfolio and unit-price snapshots captured by the backend sync flow. Snapshot totals, cash, and P&L are stored in the fund currency after sync-time FX conversion."
      />
      {!data || data.snapshotSeries.length === 0 ? (
        <EmptyState
          icon={ActivitySquare}
          title="No performance history yet"
          description="Capture the first snapshot from the admin page to start building the performance timeline."
        />
      ) : (
        <>
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
                    <YAxis tickFormatter={(value) => formatCurrencyAxis(Number(value), 'GBP', 0)} width={72} />
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
                    <YAxis tickFormatter={(value) => formatCurrencyAxis(Number(value), 'GBP', 2)} width={72} />
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
