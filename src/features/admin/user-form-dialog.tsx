import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { createClubUser } from '@/lib/api'

const userSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(['admin', 'viewer']),
})

type UserFormValues = z.infer<typeof userSchema>

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserFormDialog({ open, onOpenChange }: UserFormDialogProps) {
  const queryClient = useQueryClient()
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      role: 'viewer',
    },
  })
  const watchedRole = useWatch({
    control: form.control,
    name: 'role',
  })

  useEffect(() => {
    if (open) {
      form.reset({
        email: '',
        username: '',
        password: '',
        role: 'viewer',
      })
    }
  }, [form, open])

  const mutation = useMutation({
    mutationFn: createClubUser,
    onSuccess: () => {
      toast.success('User created.')
      void queryClient.invalidateQueries({ queryKey: ['managed-users'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-data'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to create user.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <Field id="user-email" label="Email" error={form.formState.errors.email?.message}>
            <Input id="user-email" type="email" {...form.register('email')} />
          </Field>
          <Field id="user-username" label="Username" error={form.formState.errors.username?.message}>
            <Input id="user-username" {...form.register('username')} />
          </Field>
          <Field
            id="user-password"
            label="Temporary password"
            hint="This is set immediately on the new Supabase auth account."
            error={form.formState.errors.password?.message}
          >
            <Input id="user-password" type="password" {...form.register('password')} />
          </Field>
          <Field id="user-role" label="Role" error={form.formState.errors.role?.message}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-3 text-sm text-muted-foreground">
            {watchedRole === 'admin'
              ? 'Admins can manage members, transactions, settings, and sync operations.'
              : 'Viewers can read the dashboard, members, holdings, and history, but cannot change the ledger.'}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Creating...' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
