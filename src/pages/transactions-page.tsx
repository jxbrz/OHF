import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRightLeft, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog'
import { TransferFormDialog } from '@/features/transactions/transfer-form-dialog'
import {
  deleteTransaction,
  deleteTransferGroup,
  fetchClubData,
  fetchMembersAndTransactions,
} from '@/lib/api'
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_OPTIONS } from '@/lib/constants'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'
import { sortItems, type SortConfig } from '@/lib/sorting'
import { buildTransferRecordMap, getTransferCounterpartyName } from '@/lib/transfers'
import type { FundTransactionRecord, UnitTransferRecord } from '@/types/app'

type TransactionsSortKey = 'date' | 'type' | 'amount' | 'unit_price_at_time' | 'units_amount'

export function TransactionsPage() {
  const { profile, role } = useAuth()
  const queryClient = useQueryClient()
  const [selectedMemberId, setSelectedMemberId] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [sortConfig, setSortConfig] = useState<SortConfig<TransactionsSortKey>>({
    key: 'date',
    direction: 'desc',
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<FundTransactionRecord | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<UnitTransferRecord | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<FundTransactionRecord | null>(null)
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
      setDeletingTransaction(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to delete transfer.')
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
  const memberNameById = new Map(members.map((member) => [member.id, member.name]))
  const transferRecordMap = buildTransferRecordMap(transactionsQuery.data?.transactions ?? [])
  const filteredTransactions = (transactionsQuery.data?.transactions ?? []).filter((transaction) => {
    const matchesMember = selectedMemberId === 'all' || transaction.member_id === selectedMemberId
    const matchesType = selectedType === 'all' || transaction.type === selectedType
    return matchesMember && matchesType
  })
  const transactions = sortItems(filteredTransactions, sortConfig, {
    amount: (item) => item.amount,
    unit_price_at_time: (item) => item.unit_price_at_time,
    units_amount: (item) => item.units_amount,
  })

  const toggleSort = (key: TransactionsSortKey) =>
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transactions"
        description="Immutable ledger for fund cashflows and private member-to-member unit transfers. Transfer amounts use the negotiated deal price, which can differ from current fund NAV."
        actions={
          role === 'admin' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTransfer(null)
                  setTransferDialogOpen(true)
                }}
              >
                <ArrowRightLeft className="size-4" />
                Transfer units
              </Button>
              <Button
                onClick={() => {
                  setEditingTransaction(null)
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
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 md:flex-row">
        <div className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Member filter</span>
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-full min-w-56">
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
            <SelectTrigger className="w-full min-w-52">
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
      {transactions.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No transactions match the current filters"
          description="Adjust the filters or create the first contribution transaction from the admin interface."
        />
      ) : (
        <div className="panel-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'date'}
                    direction={sortConfig.direction}
                    label="Date"
                    onClick={() => toggleSort('date')}
                  />
                </TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'type'}
                    direction={sortConfig.direction}
                    label="Type"
                    onClick={() => toggleSort('type')}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'amount'}
                    direction={sortConfig.direction}
                    label="Amount"
                    onClick={() => toggleSort('amount')}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'unit_price_at_time'}
                    direction={sortConfig.direction}
                    label="Unit price"
                    onClick={() => toggleSort('unit_price_at_time')}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    active={sortConfig.key === 'units_amount'}
                    direction={sortConfig.direction}
                    label="Units"
                    onClick={() => toggleSort('units_amount')}
                  />
                </TableHead>
                <TableHead>Notes</TableHead>
                {role === 'admin' ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDateTime(transaction.date)}</TableCell>
                  <TableCell>{memberNameById.get(transaction.member_id) ?? 'Unknown member'}</TableCell>
                  <TableCell>{getTransferCounterpartyName(transaction, memberNameById) ?? 'None'}</TableCell>
                  <TableCell>{TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type}</TableCell>
                  <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                  <TableCell>{formatNumber(transaction.unit_price_at_time, 6)}</TableCell>
                  <TableCell>{formatNumber(transaction.units_amount, 6)}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {transaction.notes ?? 'No notes'}
                  </TableCell>
                  {role === 'admin' ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            if (transaction.transfer_group_id) {
                              const transfer = transferRecordMap.get(transaction.transfer_group_id)
                              if (!transfer) {
                                toast.error('This transfer is incomplete in the ledger and cannot be edited.')
                                return
                              }

                              setEditingTransfer(transfer)
                              setTransferDialogOpen(true)
                              return
                            }

                            setEditingTransaction(transaction)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeletingTransaction(transaction)}
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
            defaultUnitPrice={clubQuery.data?.latestSnapshot?.unit_price ?? clubQuery.data?.startingUnitPrice ?? 1}
            members={members}
            open={dialogOpen}
            profileId={profile?.id ?? null}
            transaction={editingTransaction}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingTransaction(null)
              }
            }}
          />
          <TransferFormDialog
            defaultUnitPrice={clubQuery.data?.latestSnapshot?.unit_price ?? clubQuery.data?.startingUnitPrice ?? 1}
            members={members}
            open={transferDialogOpen}
            profileId={profile?.id ?? null}
            transactions={transactionsQuery.data?.transactions ?? []}
            transfer={editingTransfer}
            onOpenChange={(open) => {
              setTransferDialogOpen(open)
              if (!open) {
                setEditingTransfer(null)
              }
            }}
          />
          <AlertDialog
            open={Boolean(deletingTransaction)}
            onOpenChange={(open) => !open && setDeletingTransaction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {deletingTransaction?.transfer_group_id ? 'Delete transfer?' : 'Delete transaction?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {deletingTransaction?.transfer_group_id
                    ? 'This removes both sides of the linked unit transfer and immediately restores the original member balances.'
                    : 'This removes the transaction from the source-of-truth ledger and immediately changes unit balances.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingTransaction) {
                      if (deletingTransaction.transfer_group_id) {
                        deleteTransferMutation.mutate(deletingTransaction.transfer_group_id)
                        return
                      }

                      deleteMutation.mutate(deletingTransaction.id)
                    }
                  }}
                >
                  {deletingTransaction?.transfer_group_id ? 'Delete transfer' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}
