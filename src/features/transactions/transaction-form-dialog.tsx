import { zodResolver } from '@hookform/resolvers/zod'
import { resolveSuggestedUnitPriceAtDate } from '@shared/calculations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/shared/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DIRECT_TRANSACTION_TYPE_OPTIONS } from '@/lib/constants'
import { createTransaction, updateTransaction } from '@/lib/api'
import { formatDateTime, formatNumber, toDateTimeLocalValue } from '@/lib/formatters'
import type { FundTransactionRecord, PortfolioSnapshotLike } from '@/types/app'
import type { Tables } from '@/types/database'

const transactionSchema = z.object({
  member_id: z.string().min(1, 'Choose a member.'),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'MANUAL_ADJUSTMENT', 'FEE']),
  date: z.string().min(1, 'Choose a date.'),
  amount: z.coerce.number(),
  unit_price_at_time: z.coerce.number().positive('Unit price must be positive.'),
  units_amount: z.coerce.number(),
  notes: z.string().max(500).optional(),
})

type TransactionFormValues = z.input<typeof transactionSchema>
type TransactionSubmitValues = z.output<typeof transactionSchema>
export type TransactionDraftValues = Partial<TransactionFormValues>

function resolveDirectTransactionType(type?: FundTransactionRecord['type']): TransactionSubmitValues['type'] {
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

interface TransactionFormDialogProps {
  members: Tables<'members'>[]
  profileId: string | null
  snapshots: PortfolioSnapshotLike[]
  startingUnitPrice: number
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: FundTransactionRecord | null
  draftTransaction?: TransactionDraftValues | null
}

export function TransactionFormDialog({
  members,
  profileId,
  snapshots,
  startingUnitPrice,
  open,
  onOpenChange,
  transaction,
  draftTransaction,
}: TransactionFormDialogProps) {
  const queryClient = useQueryClient()
  const form = useForm<TransactionFormValues, undefined, TransactionSubmitValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      member_id: transaction?.member_id ?? draftTransaction?.member_id ?? '',
      type: resolveDirectTransactionType(transaction?.type ?? draftTransaction?.type),
      date: transaction?.date
        ? toDateTimeLocalValue(transaction.date)
        : draftTransaction?.date ?? toDateTimeLocalValue(new Date().toISOString()),
      amount: transaction?.amount ?? draftTransaction?.amount ?? 0,
      unit_price_at_time: transaction?.unit_price_at_time ?? draftTransaction?.unit_price_at_time ?? undefined,
      units_amount: transaction?.units_amount ?? draftTransaction?.units_amount ?? 0,
      notes: transaction?.notes ?? draftTransaction?.notes ?? '',
    },
  })

  const watchedType = useWatch({
    control: form.control,
    name: 'type',
  })
  const watchedDate = useWatch({
    control: form.control,
    name: 'date',
  })
  const watchedAmount = Number(
    useWatch({
      control: form.control,
      name: 'amount',
    }) ?? 0
  )
  const watchedUnitPrice = Number(
    useWatch({
      control: form.control,
      name: 'unit_price_at_time',
    }) ?? 0
  )
  const watchedUnitsAmount = Number(
    useWatch({
      control: form.control,
      name: 'units_amount',
    }) ?? 0
  )

  useEffect(() => {
    form.reset({
      member_id: transaction?.member_id ?? draftTransaction?.member_id ?? '',
      type: resolveDirectTransactionType(transaction?.type ?? draftTransaction?.type),
      date: transaction?.date
        ? toDateTimeLocalValue(transaction.date)
        : draftTransaction?.date ?? toDateTimeLocalValue(new Date().toISOString()),
      amount: transaction?.amount ?? draftTransaction?.amount ?? 0,
      unit_price_at_time: transaction?.unit_price_at_time ?? draftTransaction?.unit_price_at_time ?? undefined,
      units_amount: transaction?.units_amount ?? draftTransaction?.units_amount ?? 0,
      notes: transaction?.notes ?? draftTransaction?.notes ?? '',
    })
  }, [draftTransaction, form, open, transaction])

  const suggestedUnitPrice = resolveSuggestedUnitPriceAtDate({
    snapshots,
    transactionDate: watchedDate ? new Date(watchedDate).toISOString() : null,
    startingUnitPrice,
  })

  useEffect(() => {
    if (watchedType === 'MANUAL_ADJUSTMENT' || watchedUnitPrice <= 0) {
      return
    }

    const computedUnits = Math.abs(watchedAmount / (watchedUnitPrice || 1))
    form.setValue('units_amount', Number.isFinite(computedUnits) ? Number(computedUnits.toFixed(8)) : 0)
  }, [form, watchedAmount, watchedType, watchedUnitPrice])

  const mutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      const payload = {
        member_id: values.member_id,
        type: values.type,
        date: new Date(values.date).toISOString(),
        amount: Number(values.amount),
        unit_price_at_time: Number(values.unit_price_at_time),
        units_amount:
          values.type === 'MANUAL_ADJUSTMENT'
            ? Number(values.units_amount)
            : Math.abs(Number(values.units_amount)),
        notes: values.notes?.trim() ? values.notes.trim() : null,
        created_by: profileId,
      }

      if (transaction) {
        return updateTransaction(transaction.id, payload)
      }

      return createTransaction(payload)
    },
    onSuccess: () => {
      toast.success(transaction ? 'Transaction updated.' : 'Transaction created.')
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to save transaction.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card/98">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit transaction' : 'New transaction'}</DialogTitle>
          <DialogDescription>
            Record direct fund cashflows here. For member-to-member unit sales, use the dedicated transfer flow.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5 overflow-y-auto pr-1 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field
            className="min-w-0"
            id="transaction-member"
            label="Member"
            error={form.formState.errors.member_id?.message}
          >
            <Controller
              control={form.control}
              name="member_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transaction-member" className="w-full">
                    <SelectValue placeholder="Choose a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            className="min-w-0"
            id="transaction-type"
            label="Type"
            error={form.formState.errors.type?.message}
          >
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transaction-type" className="w-full">
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECT_TRANSACTION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field className="min-w-0" id="transaction-date" label="Date" error={form.formState.errors.date?.message}>
            <Input id="transaction-date" type="datetime-local" {...form.register('date')} />
          </Field>
          <Field
            className="min-w-0"
            id="transaction-amount"
            label="Amount"
            error={form.formState.errors.amount?.message}
          >
            <Input id="transaction-amount" step="0.01" type="number" {...form.register('amount')} />
          </Field>
          <Field
            className="min-w-0"
            id="transaction-unit-price"
            label="Unit price at time"
            error={form.formState.errors.unit_price_at_time?.message}
          >
            <Input
              id="transaction-unit-price"
              placeholder={suggestedUnitPrice.unitPrice.toFixed(8)}
              step="0.00000001"
              type="number"
              {...form.register('unit_price_at_time')}
            />
            <span className="rounded-lg bg-secondary/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Suggested price {formatNumber(suggestedUnitPrice.unitPrice, 8)} from{' '}
              {suggestedUnitPrice.source === 'snapshot' && suggestedUnitPrice.snapshotCapturedAt
                ? `the latest snapshot before this date (${formatDateTime(suggestedUnitPrice.snapshotCapturedAt)})`
                : 'the starting unit price'}.
            </span>
          </Field>
          <Field
            className="min-w-0"
            id="transaction-units"
            label="Units amount"
            error={form.formState.errors.units_amount?.message}
          >
            <Input
              id="transaction-units"
              readOnly={watchedType !== 'MANUAL_ADJUSTMENT'}
              step="0.00000001"
              type="number"
              {...form.register('units_amount')}
            />
            {watchedType !== 'MANUAL_ADJUSTMENT' ? (
              <span className="rounded-lg bg-secondary/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Auto-calculated from amount and unit price: {formatNumber(watchedUnitsAmount, 8)}
              </span>
            ) : null}
          </Field>
          <Field
            className="min-w-0 md:col-span-2"
            id="transaction-notes"
            label="Notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea id="transaction-notes" rows={4} {...form.register('notes')} />
          </Field>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving...' : transaction ? 'Save changes' : 'Create transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
