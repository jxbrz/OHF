import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ id, label, error, hint, children, className }: FieldProps) {
  return (
    <label className={cn('grid gap-2.5', className)} htmlFor={id}>
      <Label
        htmlFor={id}
        className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {!error && hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {error ? <span className="text-xs text-loss">{error}</span> : null}
    </label>
  )
}
