import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CandlestickChart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { PnlValue } from '@/components/shared/pnl-value'
import { SortableHeader } from '@/components/shared/sortable-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchClubData } from '@/lib/api'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'
import { sortItems, type SortConfig } from '@/lib/sorting'

type HoldingsSortKey = 'symbol' | 'marketValue' | 'pnl' | 'allocationPct'

export function HoldingsPage() {
  const [sortConfig, setSortConfig] = useState<SortConfig<HoldingsSortKey>>({
    key: 'marketValue',
    direction: 'desc',
  })
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title="Unable to load holdings"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown holdings error.'}
      />
    )
  }

  const data = clubQuery.data
  const holdings = data
    ? sortItems(data.holdingsRows, sortConfig, {
        marketValue: (item) => item.marketValue,
        pnl: (item) => item.pnl,
        allocationPct: (item) => item.allocationPct,
      })
    : []

  const toggleSort = (key: HoldingsSortKey) =>
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Holdings"
        description={`Latest position snapshot ${
          data?.latestSnapshot ? `captured ${formatDateTime(data.latestSnapshot.captured_at)}` : 'is not available yet'
        }. Quote prices remain in USD, while market value and P&L are converted into ${data?.fundCurrency ?? 'GBP'} during sync.`}
      />
      {!data || holdings.length === 0 ? (
        <EmptyState
          icon={CandlestickChart}
          title="No holdings snapshot available"
          description="Run the secure sync to capture broker holdings and populate this table."
        />
      ) : (
        <div className="panel-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'symbol'}
                    direction={sortConfig.direction}
                    label="Symbol"
                    onClick={() => toggleSort('symbol')}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Avg cost (USD)</TableHead>
                <TableHead className="text-right">Current price (USD)</TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'marketValue'}
                    direction={sortConfig.direction}
                    label="Market value (GBP)"
                    onClick={() => toggleSort('marketValue')}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'pnl'}
                    direction={sortConfig.direction}
                    label="P&L (GBP)"
                    onClick={() => toggleSort('pnl')}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'allocationPct'}
                    direction={sortConfig.direction}
                    label="Allocation"
                    onClick={() => toggleSort('allocationPct')}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding) => (
                <TableRow key={holding.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      to={`/holdings/${encodeURIComponent(holding.symbol)}`}
                      className="transition-colors hover:text-primary"
                    >
                      {holding.symbol}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    <Link
                      to={`/holdings/${encodeURIComponent(holding.symbol)}`}
                      className="transition-colors hover:text-foreground"
                    >
                      {holding.instrumentName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(holding.quantity, 6)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(holding.averageOpen, 'USD')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(holding.currentPrice, 'USD')}</TableCell>
                  <TableCell>{formatCurrency(holding.marketValue)}</TableCell>
                  <TableCell>
                    <PnlValue value={holding.pnl} />
                  </TableCell>
                  <TableCell>{(holding.allocationPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
