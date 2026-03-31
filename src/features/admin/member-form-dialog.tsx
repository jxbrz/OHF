import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/shared/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createMember, updateMember } from '@/lib/api'
import type { Tables } from '@/types/database'

const memberSchema = z.object({
  name: z.string().trim().min(2, 'Member name is required.'),
  is_active: z.enum(['true', 'false']),
})

type MemberFormValues = z.infer<typeof memberSchema>

interface MemberFormDialogProps {
  member?: Tables<'members'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MemberFormDialog({ member, open, onOpenChange }: MemberFormDialogProps) {
  const queryClient = useQueryClient()
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: member?.name ?? '',
      is_active: member?.is_active ? 'true' : 'false',
    },
  })
  const watchedStatus = useWatch({
    control: form.control,
    name: 'is_active',
  })

  useEffect(() => {
    form.reset({
      name: member?.name ?? '',
      is_active: member?.is_active ? 'true' : 'false',
    })
  }, [form, member, open])

  const mutation = useMutation({
    mutationFn: async (values: MemberFormValues) => {
      if (member) {
        return updateMember(member.id, {
          name: values.name,
          is_active: values.is_active === 'true',
        })
      }

      return createMember({
        name: values.name,
        is_active: values.is_active === 'true',
      })
    },
    onSuccess: () => {
      toast.success(member ? 'Member updated.' : 'Member created.')
      void queryClient.invalidateQueries({ queryKey: ['club-data'] })
      void queryClient.invalidateQueries({ queryKey: ['members-transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to save member.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field id="member-name" label="Member name" error={form.formState.errors.name?.message}>
            <Input id="member-name" {...form.register('name')} />
          </Field>
          <Field id="member-status" label="Status" error={form.formState.errors.is_active?.message}>
            <Select
              value={watchedStatus}
              onValueChange={(value) => form.setValue('is_active', value as 'true' | 'false')}
            >
              <SelectTrigger id="member-status" className="w-full">
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving...' : member ? 'Save changes' : 'Create member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
