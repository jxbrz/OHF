import { CandlestickChart, ArrowLeft, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
import { buildHoldingDetailView } from '@/lib/holding-details'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
} from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function HoldingProfilePage() {
  const { symbol: rawSymbol } = useParams<{ symbol: string }>()
  const symbol = rawSymbol ? decodeURIComponent(rawSymbol) : null
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  if (clubQuery.isError) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title="Unable to load holding profile"
        description={clubQuery.error instanceof Error ? clubQuery.error.message : 'Unknown holding error.'}
      />
    )
  }

  if (!clubQuery.data || !symbol) {
    return null
  }

  const data = clubQuery.data
  const holdingsInOrder = [...data.holdingsRows].sort(
    (left, right) => right.marketValue - left.marketValue || left.symbol.localeCompare(right.symbol)
  )
  const holding = holdingsInOrder.find((entry) => entry.symbol === symbol)

  if (!holding) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title="Holding not found"
        description="That symbol is not present in the latest broker snapshot."
      />
    )
  }

  const holdingIndex = holdingsInOrder.findIndex((entry) => entry.symbol === holding.symbol)
  const previousHolding = holdingIndex > 0 ? holdingsInOrder[holdingIndex - 1] : null
  const nextHolding =
    holdingIndex >= 0 && holdingIndex < holdingsInOrder.length - 1
      ? holdingsInOrder[holdingIndex + 1]
      : null
  const brokerCurrency = data.brokerCurrency === 'GBP' ? 'GBP' : 'USD'
  const fundCurrency = data.fundCurrency === 'USD' ? 'USD' : 'GBP'
  const detail = buildHoldingDetailView({
    symbol: holding.symbol,
    holding,
    latestSnapshot: data.latestSnapshot,
    brokerCurrency,
    fundCurrency,
  })
  const totalInvestedBroker = detail.positions.reduce((total, position) => total + position.investedValueBroker, 0)
  const totalInvestedFund = detail.positions.reduce((total, position) => total + position.marketValueFund - position.pnlFund, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title={detail.symbol}
        description={`Latest position book for ${detail.instrumentName}. Quote prices are shown in ${brokerCurrency}, while market value and P&L are shown in ${fundCurrency}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/holdings">
                <ArrowLeft className="size-4" />
                Back to holdings
              </Link>
            </Button>
            {previousHolding ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/holdings/${encodeURIComponent(previousHolding.symbol)}`}>
                  {previousHolding.symbol}
                </Link>
              </Button>
            ) : null}
            {nextHolding ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/holdings/${encodeURIComponent(nextHolding.symbol)}`}>
                  {nextHolding.symbol}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="panel-surface overflow-hidden">
        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_minmax(0,0.85fr)]">
          <div className="flex items-center gap-4">
            {detail.logoUrl ? (
              <img
                src={detail.logoUrl}
                alt={`${detail.symbol} logo`}
                className="size-16 rounded-2xl border border-border/70 bg-background/50 object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-background/40 text-sm font-semibold tracking-[0.14em] text-muted-foreground">
                {detail.symbol.slice(0, 6)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">{detail.symbol}</h2>
                <span className="text-lg text-muted-foreground">{detail.instrumentName}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>Snapshot {detail.capturedAt ? formatDateTime(detail.capturedAt) : 'not available'}</span>
                <span>{detail.positions.length} open position{detail.positions.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center border-t border-border/60 pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current price</div>
            <div className="mt-2 text-4xl font-semibold text-foreground">
              {formatCurrency(detail.currentPrice, brokerCurrency)}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {formatNumber(detail.quantity, 6)} units held at an average open of{' '}
              {formatCurrency(detail.averageOpen, brokerCurrency)}
            </div>
          </div>

          <div className="grid gap-4 border-t border-border/60 pt-4 md:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current value</div>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {formatCurrency(detail.marketValue, fundCurrency)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Allocation {(detail.allocationPct * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total P&amp;L</div>
              <div className="mt-2 text-3xl font-semibold">
                <PnlValue value={detail.pnl} currency={fundCurrency} />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Invested {formatCurrency(totalInvestedBroker, brokerCurrency)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/70 bg-secondary/10 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Positions</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{detail.positions.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total units</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(detail.quantity, 6)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Blended entry value</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {formatCurrency(totalInvestedFund, fundCurrency)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Snapshot basis</div>
            <div className="mt-2 text-sm font-medium text-foreground">
              Latest broker snapshot with position-level breakdown
            </div>
          </div>
        </div>
      </section>

      <section className="panel-surface overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="font-semibold text-foreground">Open positions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each row below reflects one open broker position for this symbol at the latest snapshot.
          </p>
        </div>
        {detail.positions.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={CandlestickChart}
              title="No position breakdown available"
              description="The holding exists in the aggregated snapshot, but the raw broker position payload was not available for this symbol."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Side</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">TP</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">P&amp;L</TableHead>
                  <TableHead className="text-right">P&amp;L (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div
                          className={cn(
                            'font-medium',
                            position.side === 'BUY' ? 'text-foreground' : 'text-loss'
                          )}
                        >
                          {position.side}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {position.isSettled === null
                            ? 'Settlement unknown'
                            : position.isSettled
                              ? 'Settled'
                              : 'Unsettled'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{position.openedAt ? formatDateTime(position.openedAt) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{formatNumber(position.quantity, 6)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(position.averageOpen, brokerCurrency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(position.currentPrice, brokerCurrency)}</TableCell>
                    <TableCell className="text-right">
                      {position.stopLoss ? formatCurrency(position.stopLoss, brokerCurrency) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {position.takeProfit ? formatCurrency(position.takeProfit, brokerCurrency) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(position.investedValueBroker, brokerCurrency)}</TableCell>
                    <TableCell className="text-right">
                      <PnlValue value={position.pnlFund} currency={fundCurrency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          position.pnlPct && position.pnlPct > 0
                            ? 'table-stat-positive'
                            : position.pnlPct && position.pnlPct < 0
                              ? 'table-stat-negative'
                              : 'text-foreground'
                        )}
                      >
                        {position.pnlPct === null ? '—' : formatPercent(position.pnlPct)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
