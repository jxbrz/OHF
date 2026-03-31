import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="panel-surface flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="rounded-full border border-border/80 bg-secondary/70 p-3">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
