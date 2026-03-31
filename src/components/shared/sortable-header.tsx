import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SortDirection } from '@/lib/sorting'
import { cn } from '@/lib/utils'

interface SortableHeaderProps {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}

export function SortableHeader({ label, active, direction, onClick }: SortableHeaderProps) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown

  return (
    <Button
      aria-pressed={active}
      className={cn(
        '-ml-2 h-auto rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition-colors',
        active
          ? 'bg-secondary/80 text-foreground shadow-inner hover:bg-secondary'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
      )}
      variant="ghost"
      onClick={onClick}
    >
      {label}
      <Icon className="size-3.5" />
    </Button>
  )
}
