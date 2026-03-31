import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRightLeft, RefreshCcw, Scale, WandSparkles } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-provider'
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog'
import { TransferFormDialog } from '@/features/transactions/transfer-form-dialog'
import {
  buildReconciliationPreview,
  deleteMemberReconciliationTarget,
  fetchReconciliationData,
  upsertMemberReconciliationTarget,
} from '@/lib/api'
import { formatCurrency, formatDateTime, formatNumber, toDateTimeLocalValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type DraftTargetState = Record<
  string,
  {
    targetUnits: string
    notes: string
  }
>

type DraftTransferState = {
  from_member_id: string
  to_member_id: string
  units_amount: number
  amount: number
  date: string
  notes: string
}

type DraftAdjustmentState = {
  member_id: string
  type: 'MANUAL_ADJUSTMENT'
  date: string
  amount: number
  unit_price_at_time: number
  units_amount: number
  notes: string
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'matched':
      return 'Matched'
    case 'needs_units_in':
      return 'Needs units in'
    case 'needs_units_out':
      return 'Needs units out'
    default:
      return 'Missing target'
  }
}

function getStatusClassName(status: string) {
  switch (status) {
    case 'matched':
      return 'border-profit/30 bg-profit/10 text-profit'
    case 'needs_units_in':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200'
    case 'needs_units_out':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
    default:
      return 'border-border/70 bg-secondary/50 text-muted-foreground'
  }
}

export function ReconciliationPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [asOfDate, setAsOfDate] = useState('')
  const [draftTargets, setDraftTargets] = useState<DraftTargetState>({})
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [draftTransfer, setDraftTransfer] = useState<DraftTransferState | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [draftAdjustment, setDraftAdjustment] = useState<DraftAdjustmentState | null>(null)

  const reconciliationQuery = useQuery({
    queryKey: ['reconciliation-data'],
    queryFn: fetchReconciliationData,
  })

  const upsertMutation = useMutation({
    mutationFn: upsertMemberReconciliationTarget,
    onSuccess: () => {
      toast.success('Reconciliation target saved.')
      void queryClient.invalidateQueries({ queryKey: ['reconciliation-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to save reconciliation target.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMemberReconciliationTarget,
    onSuccess: () => {
      toast.success('Reconciliation target cleared.')
      void queryClient.invalidateQueries({ queryKey: ['reconciliation-data'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to clear reconciliation target.')
    },
  })

  if (reconciliationQuery.isError) {
    return (
      <EmptyState
        icon={Scale}
        title="Unable to load reconciliation"
        description={
          reconciliationQuery.error instanceof Error
            ? reconciliationQuery.error.message
            : 'Unknown reconciliation error.'
        }
      />
    )
  }

  const data = reconciliationQuery.data
  const resolvedAsOfDate =
    asOfDate ||
    toDateTimeLocalValue(data?.latestSnapshot?.captured_at ?? new Date().toISOString())
  const asOfDateIso = new Date(resolvedAsOfDate).toISOString()
  const preview = data
    ? buildReconciliationPreview({
        data,
        asOfDate: asOfDateIso,
      })
    : null

  const currentUnitPrice = data?.currentUnitPrice ?? 1

  const getDraftUnits = (memberId: string, fallback: number | null) =>
    draftTargets[memberId]?.targetUnits ?? (fallback !== null ? String(fallback) : '')

  const getDraftNotes = (memberId: string, fallback: string | null) =>
    draftTargets[memberId]?.notes ?? (fallback ?? '')

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reconciliation"
        description="Compare the immutable ledger against the true current unit ownership, then turn the gaps into transfers or manual backfill adjustments."
        actions={
          data ? (
            <Button
              variant="outline"
              onClick={() => {
                setDraftTargets({})
                void queryClient.invalidateQueries({ queryKey: ['reconciliation-data'] })
              }}
            >
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
          ) : null
        }
      />
      {!data || !preview ? (
        <EmptyState
          icon={Scale}
          title="Reconciliation data is not ready"
          description="Once members, transactions, and a current unit price exist, the reconciliation workspace will appear here."
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="panel-surface p-5">
              <div className="mb-5 space-y-1">
                <h2 className="text-lg font-semibold">Comparison basis</h2>
                <p className="text-sm text-muted-foreground">
                  The ledger side is recalculated as of the chosen timestamp, then compared against your target unit balances.
                </p>
              </div>
              <div className="grid gap-4">
                <label className="grid gap-2" htmlFor="reconciliation-as-of-date">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Reconcile ledger as of
                  </span>
                  <Input
                    id="reconciliation-as-of-date"
                    type="datetime-local"
                    value={resolvedAsOfDate}
                    onChange={(event) => setAsOfDate(event.target.value)}
                  />
                </label>
                <div className="rounded-xl border border-border/70 bg-secondary/35 p-4 text-sm text-muted-foreground">
                  Latest broker snapshot:{' '}
                  <strong className="text-foreground">
                    {data.latestSnapshot ? formatDateTime(data.latestSnapshot.captured_at) : 'Not captured yet'}
                  </strong>
                  <div className="mt-2">
                    Current unit price:{' '}
                    <strong className="text-foreground">{formatCurrency(currentUnitPrice)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="panel-surface p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ledger units</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {formatNumber(preview.summary.ledgerUnitsTotal, 8)}
                </div>
              </div>
              <div className="panel-surface p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Targeted units</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {formatNumber(preview.summary.targetedUnitsTotal, 8)}
                </div>
              </div>
              <div className="panel-surface p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Residual delta</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {formatNumber(preview.summary.unitsDelta, 8)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatCurrency(preview.summary.valueDelta)} at current unit price
                </div>
              </div>
              <div className="panel-surface p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Coverage</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {preview.summary.matchedCount}/{preview.rows.length}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {preview.summary.missingTargetCount} members still need targets
                </div>
              </div>
            </div>
          </div>

          <div className="panel-surface p-5">
            <div className="mb-5 space-y-1">
              <h2 className="text-lg font-semibold">Suggested transfers</h2>
              <p className="text-sm text-muted-foreground">
                When the total target balances net to the same total units as the ledger, the app can suggest likely seller-to-buyer transfers for you to review and record.
              </p>
            </div>
            {preview.transferSuggestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-secondary/25 p-4 text-sm text-muted-foreground">
                No balanced transfer suggestions yet. Save target unit balances first, then any remaining unmatched difference can be backfilled with manual adjustments.
              </div>
            ) : (
              <div className="space-y-3">
                {preview.transferSuggestions.map((suggestion) => (
                  <div
                    key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${suggestion.units}`}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-secondary/25 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {suggestion.fromMemberName} to {suggestion.toMemberName}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatNumber(suggestion.units, 8)} units, indicative value{' '}
                        {formatCurrency(suggestion.indicativeAmount)}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setDraftTransfer({
                          from_member_id: suggestion.fromMemberId,
                          to_member_id: suggestion.toMemberId,
                          units_amount: suggestion.units,
                          amount: suggestion.indicativeAmount,
                          date: resolvedAsOfDate,
                          notes: `Reconciliation backfill as of ${asOfDateIso}.`,
                        })
                        setTransferDialogOpen(true)
                      }}
                    >
                      <ArrowRightLeft className="size-4" />
                      Record transfer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ledger units</TableHead>
                  <TableHead className="text-right">Target units</TableHead>
                  <TableHead className="text-right">Unit delta</TableHead>
                  <TableHead className="text-right">Value delta</TableHead>
                  <TableHead>Target notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  (() => {
                    const draftUnits = getDraftUnits(row.memberId, row.targetUnits)
                    const parsedDraftUnits = draftUnits.trim() === '' ? null : Number(draftUnits)
                    const displayTargetUnits =
                      parsedDraftUnits !== null && Number.isFinite(parsedDraftUnits)
                        ? parsedDraftUnits
                        : row.targetUnits
                    const displayUnitDiff =
                      displayTargetUnits !== null
                        ? Number((displayTargetUnits - row.ledgerUnits).toFixed(8))
                        : null
                    const displayValueDiff =
                      displayUnitDiff !== null
                        ? Number((displayUnitDiff * currentUnitPrice).toFixed(6))
                        : null
                    const displayStatus =
                      displayTargetUnits === null
                        ? 'missing_target'
                        : Math.abs(displayUnitDiff ?? 0) <= 0.00000001
                          ? 'matched'
                          : (displayUnitDiff ?? 0) > 0
                            ? 'needs_units_in'
                            : 'needs_units_out'

                    return (
                      <TableRow key={row.memberId}>
                        <TableCell>
                          <div className="font-medium text-foreground">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.targetAsOfDate ? `Saved ${formatDateTime(row.targetAsOfDate)}` : 'No target saved yet'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('border', getStatusClassName(displayStatus))} variant="outline">
                            {getStatusLabel(displayStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-foreground">{formatNumber(row.ledgerUnits, 8)}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(row.ledgerValue)}</div>
                        </TableCell>
                        <TableCell className="min-w-44">
                          <Input
                            step="0.00000001"
                            type="number"
                            value={draftUnits}
                            onChange={(event) =>
                              setDraftTargets((current) => ({
                                ...current,
                                [row.memberId]: {
                                  targetUnits: event.target.value,
                                  notes: getDraftNotes(row.memberId, row.targetNotes),
                                },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {displayUnitDiff !== null ? formatNumber(displayUnitDiff, 8) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {displayValueDiff !== null ? formatCurrency(displayValueDiff) : '—'}
                        </TableCell>
                        <TableCell className="min-w-56">
                          <Input
                            value={getDraftNotes(row.memberId, row.targetNotes)}
                            onChange={(event) =>
                              setDraftTargets((current) => ({
                                ...current,
                                [row.memberId]: {
                                  targetUnits: draftUnits,
                                  notes: event.target.value,
                                },
                              }))
                            }
                            placeholder="Optional note about the true balance"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (draftUnits.trim() === '') {
                                  toast.error('Enter a target units value before saving.')
                                  return
                                }

                                upsertMutation.mutate({
                                  member_id: row.memberId,
                                  target_units: Number(draftUnits),
                                  as_of_date: asOfDateIso,
                                  notes: getDraftNotes(row.memberId, row.targetNotes).trim() || null,
                                  updated_by: profile?.id ?? null,
                                })
                              }}
                            >
                              Save target
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDraftTargets((current) => {
                                  const next = { ...current }
                                  delete next[row.memberId]
                                  return next
                                })

                                if (row.targetUnits !== null) {
                                  deleteMutation.mutate(row.memberId)
                                }
                              }}
                            >
                              Clear
                            </Button>
                            {displayUnitDiff !== null && Math.abs(displayUnitDiff) > 0.00000001 ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDraftAdjustment({
                                    member_id: row.memberId,
                                    type: 'MANUAL_ADJUSTMENT',
                                    date: resolvedAsOfDate,
                                    amount: Number((displayValueDiff ?? 0).toFixed(6)),
                                    unit_price_at_time: currentUnitPrice,
                                    units_amount: displayUnitDiff,
                                    notes: `Reconciliation backfill as of ${asOfDateIso}.`,
                                  })
                                  setTransactionDialogOpen(true)
                                }}
                              >
                                <WandSparkles className="size-4" />
                                Draft adjustment
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })()
                ))}
              </TableBody>
            </Table>
          </div>

          <TransferFormDialog
            defaultUnitPrice={currentUnitPrice}
            draftTransfer={draftTransfer}
            members={data.members}
            open={transferDialogOpen}
            profileId={profile?.id ?? null}
            transactions={data.transactions}
            onOpenChange={(open) => {
              setTransferDialogOpen(open)
              if (!open) {
                setDraftTransfer(null)
              }
            }}
          />
          <TransactionFormDialog
            defaultUnitPrice={currentUnitPrice}
            draftTransaction={draftAdjustment}
            members={data.members}
            open={transactionDialogOpen}
            profileId={profile?.id ?? null}
            onOpenChange={(open) => {
              setTransactionDialogOpen(open)
              if (!open) {
                setDraftAdjustment(null)
              }
            }}
          />
        </>
      )}
    </div>
  )
}
