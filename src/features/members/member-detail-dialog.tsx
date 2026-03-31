import { buildMemberLotSummary } from '@shared/calculations'
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
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'
import { getTransferCounterpartyName } from '@/lib/transfers'
import type { FundTransactionRecord, MemberSummaryRow } from '@/types/app'
import type { Tables } from '@/types/database'

interface MemberDetailDialogProps {
  member: MemberSummaryRow | null
  members: Tables<'members'>[]
  transactions: FundTransactionRecord[]
  currentUnitPrice: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MemberDetailDialog({
  member,
  members,
  transactions,
  currentUnitPrice,
  open,
  onOpenChange,
}: MemberDetailDialogProps) {
  const memberNameById = new Map(members.map((entry) => [entry.id, entry.name]))
  const memberTransactions = member
    ? transactions.filter((transaction) => transaction.member_id === member.id)
    : []
  const lotSummary = member
    ? buildMemberLotSummary({
        transactions: memberTransactions,
        currentUnitPrice,
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-card">
        <DialogHeader>
          <DialogTitle>{member?.name ?? 'Member details'}</DialogTitle>
          <DialogDescription>
            Cash paid in, cash received, remaining cost basis, and current ownership for this member.
          </DialogDescription>
        </DialogHeader>
        {member ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cash paid in</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.totalInvested)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cash received</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.totalReturned)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Remaining cost basis</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.remainingCostBasis)}</div>
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
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Realized return</div>
                <div className="mt-2 text-xl font-semibold">
                  <PnlValue value={member.realizedReturn} />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Unrealized return</div>
                <div className="mt-2 text-xl font-semibold">
                  <PnlValue value={member.unrealizedReturn} />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Net cash outlay</div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(member.netInvested)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Historical cash paid in minus cash received
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Open lots</div>
                <div className="mt-2 text-xl font-semibold">{member.openLotCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Avg cost {formatCurrency(member.averageCostPerUnit)}
                </div>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Units ledger</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Units bought</div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(member.unitsBought, 6)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Units sold</div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(member.unitsSold, 6)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transfer units in</div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(member.transferUnitsIn, 6)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transfer units out</div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(member.transferUnitsOut, 6)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Net units</div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(member.netUnits, 6)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Ownership</div>
                    <div className="mt-1 text-lg font-semibold">{(member.ownershipPct * 100).toFixed(2)}%</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cash-flow breakdown</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Deposits</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(member.deposits)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Withdrawals</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(member.withdrawals)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transfer in</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(member.transferInAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transfer out</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(member.transferOutAmount)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Manual cash adjustments
                    </div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(member.manualAdjustments)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="panel-surface overflow-hidden">
                <div className="border-b border-border/70 px-4 py-3">
                  <h3 className="font-semibold text-foreground">Open lots</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    FIFO lots still held by this member at the current unit price.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opened</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Cost basis</TableHead>
                      <TableHead className="text-right">Cost / unit</TableHead>
                      <TableHead className="text-right">Unrealized</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotSummary && lotSummary.openLots.length > 0 ? (
                      lotSummary.openLots.map((lot) => (
                        <TableRow key={lot.lotId}>
                          <TableCell>{formatDateTime(lot.openedAt)}</TableCell>
                          <TableCell>{TRANSACTION_TYPE_LABELS[lot.sourceType] ?? lot.sourceType}</TableCell>
                          <TableCell className="text-right">{formatNumber(lot.remainingUnits, 6)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(lot.remainingCostBasis)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(lot.costPerUnit)}</TableCell>
                          <TableCell className="text-right">
                            <PnlValue
                              value={Number(
                                (lot.remainingUnits * currentUnitPrice - lot.remainingCostBasis).toFixed(6)
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={6}>
                          No open lots for this member.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="panel-surface overflow-hidden">
                <div className="border-b border-border/70 px-4 py-3">
                  <h3 className="font-semibold text-foreground">Realized lot history</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    FIFO matches from withdrawals, transfers out, fees, and negative adjustments.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Closed</TableHead>
                      <TableHead>Lot source</TableHead>
                      <TableHead>Exit type</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Cost basis</TableHead>
                      <TableHead className="text-right">Proceeds</TableHead>
                      <TableHead className="text-right">Realized</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotSummary && lotSummary.dispositions.length > 0 ? (
                      lotSummary.dispositions.map((disposition, index) => (
                        <TableRow key={`${disposition.lotId}-${index}`}>
                          <TableCell>{formatDateTime(disposition.closedAt)}</TableCell>
                          <TableCell>{TRANSACTION_TYPE_LABELS[disposition.sourceType] ?? disposition.sourceType}</TableCell>
                          <TableCell>{TRANSACTION_TYPE_LABELS[disposition.closingType] ?? disposition.closingType}</TableCell>
                          <TableCell className="text-right">{formatNumber(disposition.units, 6)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(disposition.costBasis)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(disposition.proceeds)}</TableCell>
                          <TableCell className="text-right">
                            <PnlValue value={disposition.realizedReturn} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={7}>
                          No realized lot history for this member yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
                    <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
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
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
