import { zodResolver } from '@hookform/resolvers/zod'
import { calculateMemberUnitsAsOf } from '@shared/calculations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/shared/field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createUnitTransfer, updateUnitTransfer } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatNumber, toDateTimeLocalValue } from '@/lib/formatters'
import type { FundTransactionRecord, UnitTransferRecord } from '@/types/app'
import type { Tables } from '@/types/database'

const transferSchema = z
  .object({
    from_member_id: z.string().min(1, 'Choose the selling member.'),
    to_member_id: z.string().min(1, 'Choose the buying member.'),
    date: z.string().min(1, 'Choose a date.'),
    amount: z.coerce.number().positive('Cash consideration must be positive.'),
    units_amount: z.coerce.number().positive('Units to transfer must be positive.'),
    notes: z.string().max(500).optional(),
  })
  .refine((values) => values.from_member_id !== values.to_member_id, {
    message: 'Choose two different members.',
    path: ['to_member_id'],
  })

type TransferFormValues = z.input<typeof transferSchema>
type TransferSubmitValues = z.output<typeof transferSchema>
export type TransferDraftValues = Partial<TransferFormValues>

interface TransferFormDialogProps {
  members: Tables<'members'>[]
  transactions: FundTransactionRecord[]
  profileId: string | null
  defaultUnitPrice: number
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer?: UnitTransferRecord | null
  draftTransfer?: TransferDraftValues | null
}

export function TransferFormDialog({
  members,
  transactions,
  profileId,
  defaultUnitPrice,
  open,
  onOpenChange,
  transfer,
  draftTransfer,
}: TransferFormDialogProps) {
  const queryClient = useQueryClient()
  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  )
  const form = useForm<TransferFormValues, undefined, TransferSubmitValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_member_id: transfer?.fromTransaction.member_id ?? draftTransfer?.from_member_id ?? '',
      to_member_id: transfer?.toTransaction.member_id ?? draftTransfer?.to_member_id ?? '',
      date: transfer?.fromTransaction.date
        ? toDateTimeLocalValue(transfer.fromTransaction.date)
        : draftTransfer?.date ?? toDateTimeLocalValue(new Date().toISOString()),
      amount:
        transfer?.fromTransaction.amount ??
        draftTransfer?.amount ??
        Number((defaultUnitPrice * (transfer?.fromTransaction.units_amount ?? 0)).toFixed(6)),
      units_amount: transfer?.fromTransaction.units_amount ?? draftTransfer?.units_amount ?? 0,
      notes: transfer?.fromTransaction.notes ?? draftTransfer?.notes ?? '',
    },
  })

  const watchedFromMemberId = useWatch({
    control: form.control,
    name: 'from_member_id',
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
  const watchedUnitsAmount = Number(
    useWatch({
      control: form.control,
      name: 'units_amount',
    }) ?? 0
  )

  useEffect(() => {
    form.reset({
      from_member_id: transfer?.fromTransaction.member_id ?? draftTransfer?.from_member_id ?? '',
      to_member_id: transfer?.toTransaction.member_id ?? draftTransfer?.to_member_id ?? '',
      date: transfer?.fromTransaction.date
        ? toDateTimeLocalValue(transfer.fromTransaction.date)
        : draftTransfer?.date ?? toDateTimeLocalValue(new Date().toISOString()),
      amount:
        transfer?.fromTransaction.amount ??
        draftTransfer?.amount ??
        Number((defaultUnitPrice * (transfer?.fromTransaction.units_amount ?? 0)).toFixed(6)),
      units_amount: transfer?.fromTransaction.units_amount ?? draftTransfer?.units_amount ?? 0,
      notes: transfer?.fromTransaction.notes ?? draftTransfer?.notes ?? '',
    })
  }, [defaultUnitPrice, draftTransfer, form, open, transfer])

  const excludedTransactionIds = transfer
    ? [transfer.fromTransaction.id, transfer.toTransaction.id]
    : undefined
  const transferDateIso = watchedDate ? new Date(watchedDate).toISOString() : new Date().toISOString()
  const availableUnits = watchedFromMemberId
    ? calculateMemberUnitsAsOf(transactions, watchedFromMemberId, transferDateIso, {
        excludeTransactionIds: excludedTransactionIds,
      })
    : 0
  const considerationAmount = watchedAmount > 0 ? Number(watchedAmount.toFixed(6)) : 0
  const effectiveUnitPrice =
    watchedUnitsAmount > 0 && considerationAmount > 0
      ? Number((considerationAmount / watchedUnitsAmount).toFixed(8))
      : 0
  const indicativeFundValue =
    watchedUnitsAmount > 0 ? Number((defaultUnitPrice * watchedUnitsAmount).toFixed(6)) : 0
  const transferDelta = Number((considerationAmount - indicativeFundValue).toFixed(6))

  const mutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      if (Number(values.units_amount) > availableUnits + 0.00000001) {
        throw new Error(
          `The selling member only has ${formatNumber(availableUnits, 8)} units available at that date.`
        )
      }

      const payload = {
        from_member_id: values.from_member_id,
        to_member_id: values.to_member_id,
        date: new Date(values.date).toISOString(),
        unit_price_at_time: Number((Number(values.amount) / Number(values.units_amount)).toFixed(8)),
        units_amount: Number(values.units_amount),
        amount: Number(values.amount),
        notes: values.notes?.trim() ? values.notes.trim() : null,
        created_by: profileId,
      }

      if (transfer) {
        return updateUnitTransfer(transfer, payload)
      }

      return createUnitTransfer(payload)
    },
    onSuccess: () => {
      toast.success(transfer ? 'Transfer updated.' : 'Transfer recorded.')
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to save transfer.'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-w-3xl bg-card/98">
        <DialogHeader>
          <DialogTitle>{transfer ? 'Edit unit transfer' : 'Transfer units'}</DialogTitle>
          <DialogDescription>
            Record the negotiated cash consideration for a private sale. It can differ from the current fund NAV.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid min-h-0 gap-5 overflow-y-auto pr-1 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field
            className="min-w-0"
            id="transfer-from-member"
            label="Selling member"
            error={form.formState.errors.from_member_id?.message}
          >
            <Controller
              control={form.control}
              name="from_member_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transfer-from-member" className="w-full">
                    <SelectValue placeholder="Choose the seller">
                      {field.value ? memberNameById.get(field.value) ?? 'Unknown member' : undefined}
                    </SelectValue>
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
            id="transfer-to-member"
            label="Buying member"
            error={form.formState.errors.to_member_id?.message}
          >
            <Controller
              control={form.control}
              name="to_member_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transfer-to-member" className="w-full">
                    <SelectValue placeholder="Choose the buyer">
                      {field.value ? memberNameById.get(field.value) ?? 'Unknown member' : undefined}
                    </SelectValue>
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
          <Field className="min-w-0" id="transfer-date" label="Date" error={form.formState.errors.date?.message}>
            <Input id="transfer-date" type="datetime-local" {...form.register('date')} />
          </Field>
          <Field
            className="min-w-0"
            id="transfer-amount"
            label="Cash consideration"
            error={form.formState.errors.amount?.message}
          >
            <Input id="transfer-amount" step="0.01" type="number" {...form.register('amount')} />
          </Field>
          <Field
            className="min-w-0"
            id="transfer-units"
            label="Units moving"
            error={form.formState.errors.units_amount?.message}
          >
            <Input id="transfer-units" step="0.00000001" type="number" {...form.register('units_amount')} />
          </Field>
          <Field className="min-w-0" id="transfer-unit-price" label="Effective transfer price / unit">
            <Input id="transfer-unit-price" readOnly value={effectiveUnitPrice.toFixed(8)} />
            <span className="rounded-lg bg-secondary/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Derived from cash consideration divided by units moving. This is the negotiated transfer price, not the current fund NAV.
            </span>
          </Field>
          <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/35 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Transfer context at the chosen date
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground">
              <span>
                Available units: <strong>{formatNumber(availableUnits, 8)}</strong>
              </span>
              <span>
                Units moving: <strong>{formatNumber(watchedUnitsAmount, 8)}</strong>
              </span>
              <span>
                Consideration: <strong>{formatCurrency(considerationAmount)}</strong>
              </span>
              <span>
                Indicative fund value: <strong>{formatCurrency(indicativeFundValue)}</strong>
              </span>
              <span>
                Premium / discount: <strong>{formatCurrency(transferDelta)}</strong>
              </span>
            </div>
          </div>
          <Field
            className="min-w-0 md:col-span-2"
            id="transfer-notes"
            label="Notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea id="transfer-notes" rows={4} {...form.register('notes')} />
          </Field>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving...' : transfer ? 'Save transfer' : 'Record transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
