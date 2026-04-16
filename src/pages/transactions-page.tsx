import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowRightLeft,
  ListOrdered,
  PencilLine,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SortableHeader } from '@/components/shared/sortable-header'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-provider'
import {
  TransactionFormDialog,
  type TransactionDraftValues,
} from '@/features/transactions/transaction-form-dialog'
import {
  TransferFormDialog,
  type TransferDraftValues,
} from '@/features/transactions/transfer-form-dialog'
import {
  deleteTransaction,
  deleteTransferGroup,
  fetchClubData,
  fetchMembersAndTransactions,
  reverseTransaction as reverseLedgerTransaction,
  reverseUnitTransfer,
} from '@/lib/api'
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_OPTIONS } from '@/lib/constants'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  toDateTimeLocalValue,
} from '@/lib/formatters'
import { buildTransferRecordMap, getTransferCounterpartyName } from '@/lib/transfers'
import type { FundTransactionRecord, UnitTransferRecord } from '@/types/app'

type TransactionsSortKey = 'date' | 'amount' | 'units'

type LedgerDisplayRow =
  | {
      kind: 'transaction'
      id: string
      date: string
      entryLabel: string
      memberLabel: string
      counterpartyLabel: string | null
      amount: number
      unitPrice: number
      units: number
      notes: string | null
      transaction: FundTransactionRecord
    }
  | {
      kind: 'transfer'
      id: string
      date: string
      entryLabel: string
      memberLabel: string
      counterpartyLabel: string
      amount: number
      unitPrice: number
      units: number
      notes: string | null
      transfer: UnitTransferRecord
    }

function sortLedgerRows(rows: LedgerDisplayRow[], sortKey: TransactionsSortKey, direction: 'asc' | 'desc') {
  const sorted = [...rows].sort((left, right) => {
    const factor = direction === 'asc' ? 1 : -1

    switch (sortKey) {
      case 'amount':
        return (left.amount - right.amount) * factor
      case 'units':
        return (left.units - right.units) * factor
      case 'date':
      default:
        return (new Date(left.date).getTime() - new Date(right.date).getTime()) * factor
    }
  })

  return sorted
}

function resolveCorrectableType(type: FundTransactionRecord['type']) {
  switch (type) {
    case 'DEPOSIT':
    case 'WITHDRAWAL':
    case 'MANUAL_ADJUSTMENT':
    case 'FEE':
      return type
    default:
      return 'DEPOSIT'
  }
}

export function TransactionsPage() {
  const { profile, role } = useAuth()
  const queryClient = useQueryClient()
  const [selectedMemberId, setSelectedMemberId] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<TransactionsSortKey>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<FundTransactionRecord | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<UnitTransferRecord | null>(null)
  const [draftTransaction, setDraftTransaction] = useState<TransactionDraftValues | null>(null)
  const [draftTransfer, setDraftTransfer] = useState<TransferDraftValues | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<FundTransactionRecord | null>(null)
  const [deletingTransfer, setDeletingTransfer] = useState<UnitTransferRecord | null>(null)
  const [reversingTransaction, setReversingTransaction] = useState<FundTransactionRecord | null>(null)
  const [reversingTransfer, setReversingTransfer] = useState<UnitTransferRecord | null>(null)

  const transactionsQuery = useQuery({
    queryKey: ['members-transactions'],
    queryFn: fetchMembersAndTransactions,
  })
  const clubQuery = useQuery({
    queryKey: ['club-data'],
    queryFn: fetchClubData,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      toast.success('Transaction deleted.')
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      setDeletingTransaction(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to delete transaction.')
    },
  })

  const deleteTransferMutation = useMutation({
    mutationFn: deleteTransferGroup,
    onSuccess: () => {
      toast.success('Transfer deleted.')
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      setDeletingTransfer(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to delete transfer.')
    },
  })

  const reverseTransactionMutation = useMutation({
    mutationFn: (transaction: FundTransactionRecord) =>
      reverseLedgerTransaction({ transaction, profileId: profile?.id ?? null }),
    onSuccess: () => {
      toast.success('Reversal recorded.')
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      setReversingTransaction(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to reverse transaction.')
    },
  })

  const reverseTransferMutation = useMutation({
    mutationFn: (transfer: UnitTransferRecord) =>
      reverseUnitTransfer({ transfer, profileId: profile?.id ?? null }),
    onSuccess: () => {
      toast.success('Transfer reversal recorded.')
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      setReversingTransfer(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to reverse transfer.')
    },
  })

  if (transactionsQuery.isError) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="Unable to load transactions"
        description={
          transactionsQuery.error instanceof Error ? transactionsQuery.error.message : 'Unknown transaction error.'
        }
      />
    )
  }

  const members = transactionsQuery.data?.members ?? []
  const fundCurrency = clubQuery.data?.fundCurrency === 'USD' ? 'USD' : 'GBP'
  const rawTransactions = transactionsQuery.data?.transactions ?? []
  const memberNameById = new Map(members.map((member) => [member.id, member.name]))
  const transferRecordMap = buildTransferRecordMap(rawTransactions)
  const normalizedSearch = searchQuery.trim().toLowerCase()

  const ledgerRows = (() => {
    const rows = rawTransactions.flatMap<LedgerDisplayRow>((transaction) => {
      if (transaction.transfer_group_id) {
        if (transaction.type !== 'TRANSFER_OUT') {
          return []
        }

        const transfer = transferRecordMap.get(transaction.transfer_group_id)
        if (!transfer) {
          return []
        }

        return [
          {
            kind: 'transfer',
            id: transfer.transferGroupId,
            date: transfer.fromTransaction.date,
            entryLabel: 'Private transfer',
            memberLabel: memberNameById.get(transfer.fromTransaction.member_id) ?? 'Unknown member',
            counterpartyLabel: memberNameById.get(transfer.toTransaction.member_id) ?? 'Unknown member',
            amount: Number(transfer.fromTransaction.amount),
            unitPrice: Number(transfer.fromTransaction.unit_price_at_time),
            units: Number(transfer.fromTransaction.units_amount),
            notes: transfer.fromTransaction.notes,
            transfer,
          },
        ]
      }

      return [
        {
          kind: 'transaction',
          id: transaction.id,
          date: transaction.date,
          entryLabel: TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type,
          memberLabel: memberNameById.get(transaction.member_id) ?? 'Unknown member',
          counterpartyLabel: getTransferCounterpartyName(transaction, memberNameById) ?? null,
          amount: Number(transaction.amount),
          unitPrice: Number(transaction.unit_price_at_time),
          units: Number(transaction.units_amount),
          notes: transaction.notes,
          transaction,
        },
      ]
    })

    const filtered = rows.filter((row) => {
      const matchesMember =
        selectedMemberId === 'all' ||
        (row.kind === 'transaction'
          ? row.transaction.member_id === selectedMemberId
          : row.transfer.fromTransaction.member_id === selectedMemberId ||
            row.transfer.toTransaction.member_id === selectedMemberId)

      const matchesType =
        selectedType === 'all' ||
        (row.kind === 'transfer'
          ? selectedType === 'TRANSFER_IN' || selectedType === 'TRANSFER_OUT'
          : row.transaction.type === selectedType)

      const searchBlob = [
        row.entryLabel,
        row.memberLabel,
        row.counterpartyLabel,
        row.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = normalizedSearch === '' || searchBlob.includes(normalizedSearch)

      return matchesMember && matchesType && matchesSearch
    })

    return sortLedgerRows(filtered, sortKey, sortDirection)
  })()

  const transferCount = ledgerRows.filter((row) => row.kind === 'transfer').length
  const directEntriesCount = ledgerRows.filter((row) => row.kind === 'transaction').length
  const latestEntry = ledgerRows[0] ?? null

  const toggleSort = (nextKey: TransactionsSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection('desc')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transactions"
        description="Source-of-truth ledger for fund cashflows and private unit sales. Prefer reverse + correct over editing history in place."
        actions={
          role === 'admin' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTransfer(null)
                  setDraftTransfer(null)
                  setTransferDialogOpen(true)
                }}
              >
                <ArrowRightLeft className="size-4" />
                Transfer units
              </Button>
              <Button
                onClick={() => {
                  setEditingTransaction(null)
                  setDraftTransaction(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                New transaction
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Visible entries</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{ledgerRows.length}</div>
        </div>
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Private transfers</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{transferCount}</div>
        </div>
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Direct fund entries</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{directEntriesCount}</div>
        </div>
        <div className="panel-surface p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest entry</div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {latestEntry ? formatDateTime(latestEntry.date) : 'No entries'}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
        <div className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Search</span>
          <Input
            placeholder="Search by member, transfer, or notes"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Member filter</span>
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Type filter</span>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TRANSACTION_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ledgerRows.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No entries match the current view"
          description="Adjust the search or filters, or create the first contribution transaction."
        />
      ) : (
        <div className="panel-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    active={sortKey === 'date'}
                    direction={sortDirection}
                    label="Date"
                    onClick={() => toggleSort('date')}
                  />
                </TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortKey === 'amount'}
                    direction={sortDirection}
                    label="Cash"
                    onClick={() => toggleSort('amount')}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortKey === 'units'}
                    direction={sortDirection}
                    label="Units"
                    onClick={() => toggleSort('units')}
                  />
                </TableHead>
                <TableHead>Notes</TableHead>
                {role === 'admin' ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerRows.map((row) => (
                <TableRow key={`${row.kind}-${row.id}`}>
                  <TableCell>{formatDateTime(row.date)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.entryLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.kind === 'transfer'
                        ? `${row.memberLabel} sold to ${row.counterpartyLabel}`
                        : row.counterpartyLabel
                          ? `${row.memberLabel} with ${row.counterpartyLabel}`
                          : row.memberLabel}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(row.unitPrice, 6)} per unit
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(row.amount, fundCurrency)}</TableCell>
                  <TableCell>{formatNumber(row.units, 6)}</TableCell>
                  <TableCell className="max-w-72 truncate text-muted-foreground">
                    {row.notes ?? 'No notes'}
                  </TableCell>
                  {role === 'admin' ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (row.kind === 'transfer') {
                              setEditingTransfer(null)
                              setDraftTransfer({
                                from_member_id: row.transfer.fromTransaction.member_id,
                                to_member_id: row.transfer.toTransaction.member_id,
                                date: toDateTimeLocalValue(row.transfer.fromTransaction.date),
                                amount: row.transfer.fromTransaction.amount,
                                units_amount: row.transfer.fromTransaction.units_amount,
                                notes: `Correction for transfer ${row.transfer.transferGroupId}.`,
                              })
                              setTransferDialogOpen(true)
                              return
                            }

                            setEditingTransaction(null)
                            setDraftTransaction({
                              member_id: row.transaction.member_id,
                              type: resolveCorrectableType(row.transaction.type),
                              date: toDateTimeLocalValue(row.transaction.date),
                              amount: row.transaction.amount,
                              unit_price_at_time: row.transaction.unit_price_at_time,
                              units_amount: row.transaction.units_amount,
                              notes: `Correction for ${row.transaction.type.toLowerCase()} ${row.transaction.id}.`,
                            })
                            setDialogOpen(true)
                          }}
                        >
                          <PencilLine className="size-4" />
                          Correct
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (row.kind === 'transfer') {
                              setReversingTransfer(row.transfer)
                              return
                            }

                            setReversingTransaction(row.transaction)
                          }}
                        >
                          <RotateCcw className="size-4" />
                          Reverse
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            if (row.kind === 'transfer') {
                              setDeletingTransfer(row.transfer)
                              return
                            }

                            setDeletingTransaction(row.transaction)
                          }}
                        >
                          <Trash2 className="size-4 text-loss" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {role === 'admin' ? (
        <>
          <TransactionFormDialog
            members={members}
            open={dialogOpen}
            profileId={profile?.id ?? null}
            snapshots={clubQuery.data?.allSnapshots ?? []}
            startingUnitPrice={clubQuery.data?.startingUnitPrice ?? 1}
            transaction={editingTransaction}
            draftTransaction={draftTransaction}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingTransaction(null)
                setDraftTransaction(null)
              }
            }}
          />
          <TransferFormDialog
            defaultUnitPrice={clubQuery.data?.dashboardSummary.currentUnitPrice ?? clubQuery.data?.startingUnitPrice ?? 1}
            members={members}
            open={transferDialogOpen}
            profileId={profile?.id ?? null}
            transactions={rawTransactions}
            transfer={editingTransfer}
            draftTransfer={draftTransfer}
            onOpenChange={(open) => {
              setTransferDialogOpen(open)
              if (!open) {
                setEditingTransfer(null)
                setDraftTransfer(null)
              }
            }}
          />

          <AlertDialog
            open={Boolean(reversingTransaction)}
            onOpenChange={(open) => !open && setReversingTransaction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reverse this entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This keeps the original row in the ledger and appends a balancing reversal entry dated now.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (reversingTransaction) {
                      reverseTransactionMutation.mutate(reversingTransaction)
                    }
                  }}
                >
                  Reverse entry
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={Boolean(reversingTransfer)}
            onOpenChange={(open) => !open && setReversingTransfer(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reverse this transfer?</AlertDialogTitle>
                <AlertDialogDescription>
                  This records a new opposite transfer and restores the units without deleting the original trade.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (reversingTransfer) {
                      reverseTransferMutation.mutate(reversingTransfer)
                    }
                  }}
                >
                  Reverse transfer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={Boolean(deletingTransaction)}
            onOpenChange={(open) => !open && setDeletingTransaction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use deletion only for duplicates or import mistakes. For normal corrections, prefer reverse + correct so the audit trail stays intact.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingTransaction) {
                      deleteMutation.mutate(deletingTransaction.id)
                    }
                  }}
                >
                  Delete entry
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={Boolean(deletingTransfer)}
            onOpenChange={(open) => !open && setDeletingTransfer(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this transfer?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes both sides of the transfer. Use it only for duplicate or erroneous imports.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingTransfer) {
                      deleteTransferMutation.mutate(deletingTransfer.transferGroupId)
                    }
                  }}
                >
                  Delete transfer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}
