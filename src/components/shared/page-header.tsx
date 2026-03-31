import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
